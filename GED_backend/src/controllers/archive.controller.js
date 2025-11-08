// src/controllers/archive.controller.js
require('dotenv').config();
const db = require('../models/db');
const AWS = require('aws-sdk');
const path = require('path');
const mime = require('mime-types');
const archiver = require('archiver');
const pLimit = require('p-limit');
const { urlToB2Key, uploadBufferToB2 } = require('../helpers/archive.helpers');
const stream = require('stream');

// Configuration du client S3 compatible Backblaze
const s3 = new AWS.S3({
  endpoint: process.env.B2_ENDPOINT,
  accessKeyId: process.env.B2_KEY_ID,
  secretAccessKey: process.env.B2_APP_KEY,
  region: process.env.B2_REGION,
  s3ForcePathStyle: true,
});

const CONCURRENCY = Number(process.env.ARCHIVE_CONCURRENCY || 5);

/* ===========================================================
   ⚙️ Helper : vérifie si un objet existe déjà sur B2
=========================================================== */
async function objectExistsInB2(key) {
  try {
    await s3.headObject({ Bucket: process.env.B2_BUCKET_NAME, Key: key }).promise();
    return true;
  } catch (err) {
    if (err.code === 'NotFound') return false;
    throw err;
  }
}

/* ===========================================================
   ⚙️ Helper : exécute une fonction avec retries exponentiels
=========================================================== */
async function withRetries(fn, retries = 3, delay = 500) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      console.warn(`⚠️ Tentative ${i + 1} échouée, nouvel essai dans ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
      delay *= 2;
    }
  }
}

/* ===========================================================
   🧩 1️⃣ Récupération des courriers pour une année donnée
=========================================================== */
async function fetchCourriersByYear(year, offset = 0, limit = 500) {
  const q = `
    SELECT
      c.id AS courrier_id,
      c.numero_enregistrement,
      c.fichier_scan,
      i.id AS imputation_id,
      i.fichier_imputation,
      i.bordereau_id AS imputation_bordereau_id
    FROM courriers c
    LEFT JOIN imputations i ON i.courrier_id = c.id
    WHERE EXTRACT(YEAR from c.date_reception) = $1
    ORDER BY c.numero_enregistrement
    OFFSET $2 LIMIT $3
  `;
  const res = await db.query(q, [year, offset, limit]);
  return res.rows;
}

/* ===========================================================
   📡 2️⃣ Récupération des transmissions pour une imputation
=========================================================== */
async function getTransmissionsForImputation(imputationId) {
  if (!imputationId) return [];
  const res = await db.query(
    `SELECT id, fichier_bordereau FROM transmissions_imputation WHERE imputation_id = $1`,
    [imputationId]
  );
  return res.rows || [];
}

/* ===========================================================
   📦 3️⃣ Téléchargement d’un objet B2 (Buffer)
=========================================================== */
async function getObjectFromB2(key) {
  const params = { Bucket: process.env.B2_BUCKET_NAME, Key: key };
  const data = await s3.getObject(params).promise();
  return data;
}

/* ===========================================================
   🧠 4️⃣ Lancer un archivage asynchrone
=========================================================== */
exports.launchArchive = async (req, res) => {
  const year = parseInt(req.params.year, 10);
  const userId = req.user?.id || null;

  try {
    const { rows } = await db.query(
      `INSERT INTO archives_runs (year, started_by, status)
       VALUES ($1, $2, 'in_progress') RETURNING id`,
      [year, userId]
    );
    const runId = rows[0].id;

    // Lancer le job en arrière-plan
    setImmediate(async () => {
      try {
        console.log(`🚀 Archivage de l’année ${year} lancé...`);
        await archiveYearProcess(year, runId);
        await db.query(
          `UPDATE archives_runs SET status='done', finished_at=NOW() WHERE id=$1`,
          [runId]
        );
        console.log(`✅ Archivage ${year} terminé avec succès`);
      } catch (error) {
        console.error("❌ Erreur lors de l’archivage :", error);
        await db.query(
          `UPDATE archives_runs SET status='error', errors_count=errors_count+1 WHERE id=$1`,
          [runId]
        );
      }
    });

    res.status(202).json({
      message: `Archivage de l’année ${year} lancé.`,
      run_id: runId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur de lancement d’archivage" });
  }
};

/* ===========================================================
   🔍 5️⃣ Vérifier le statut d’un archivage
=========================================================== */
exports.getArchiveStatus = async (req, res) => {
  const year = parseInt(req.params.year, 10);
  try {
    const { rows } = await db.query(
      `SELECT * FROM archives_runs WHERE year = $1 ORDER BY created_at DESC LIMIT 1`,
      [year]
    );
    if (rows.length === 0)
      return res.status(404).json({ message: "Aucune archive pour cette année" });
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur lors de la récupération du statut" });
  }
};

/* ===========================================================
   🧩 6️⃣ Processus principal d’archivage (tâche asynchrone)
=========================================================== */
async function archiveYearProcess(year, runId) {
  const limit = 500;
  let offset = 0;
  const limitConcurrency = pLimit(CONCURRENCY);
  const errors = [];

  while (true) {
    const courriers = await fetchCourriersByYear(year, offset, limit);
    if (!courriers.length) break;

    const tasks = courriers.map(c => limitConcurrency(async () => {
      const dossierPrefix = `archives/${year}/courrier_${c.numero_enregistrement}_${c.courrier_id}/`;
      const toArchive = [];

      // 1️⃣ Fichiers du courrier
      let fichiersCourrier = [];
      try {
        fichiersCourrier = Array.isArray(c.fichier_scan) ? c.fichier_scan : JSON.parse(c.fichier_scan);
      } catch {
        fichiersCourrier = typeof c.fichier_scan === 'string' && c.fichier_scan ? [c.fichier_scan] : [];
      }

      fichiersCourrier.forEach((fUrl) => {
        toArchive.push({
          src: fUrl,
          destName: `01_courrier_${c.courrier_id}_${path.basename(fUrl)}`,
        });
      });

      // 2️⃣ Bordereau d’imputation
      if (c.fichier_imputation) {
        toArchive.push({
          src: c.fichier_imputation,
          destName: `02_bordereau_imputation_${c.imputation_id || 'NA'}.pdf`,
        });
      }

      // 3️⃣ Bordereaux de transmission
      const transmissions = await getTransmissionsForImputation(c.imputation_id);
      transmissions.forEach((t) => {
        if (t.fichier_bordereau) {
          toArchive.push({
            src: t.fichier_bordereau,
            destName: `03_transmission_${t.id}.pdf`,
          });
        }
      });

      // 📤 Upload sur B2
      for (const f of toArchive) {
        try {
          const key = urlToB2Key(f.src);
          const b2Key = `${dossierPrefix}${f.destName}`;
          const exists = await objectExistsInB2(b2Key);
          if (exists) return;

          const s3Obj = await withRetries(() => getObjectFromB2(decodeURIComponent(key)));
          const contentType = s3Obj.ContentType || mime.lookup(f.destName) || 'application/octet-stream';
          await withRetries(() => uploadBufferToB2(s3Obj.Body, b2Key, contentType));
        } catch (err) {
          console.error(`❌ Erreur fichier : ${f.src}`, err.message);
          errors.push({ courrier_id: c.courrier_id, file: f.src, error: err.message });
        }
      }
    }));

    await Promise.all(tasks);
    offset += limit;
  }

  if (errors.length) {
    await db.query(
      `UPDATE archives_runs SET errors=$1, errors_count=$2 WHERE id=$3`,
      [JSON.stringify(errors), errors.length, runId]
    );
  }
}

/* ===========================================================
   📥 7️⃣ Téléchargement d'une archive ZIP (stream)
=========================================================== */
exports.downloadArchive = async (req, res) => {
  try {
    const year = req.params.year;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=archive_${year}.zip`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', err => { throw err; });
    archive.pipe(res);

    // Liste les objets du dossier "archives/<year>/"
    const list = await s3.listObjectsV2({
      Bucket: process.env.B2_BUCKET_NAME,
      Prefix: `archives/${year}/`,
    }).promise();

    for (const obj of list.Contents) {
      const key = obj.Key;
      const fileStream = s3.getObject({
        Bucket: process.env.B2_BUCKET_NAME,
        Key: key,
      }).createReadStream();

      const nameInZip = key.replace(`archives/${year}/`, '');
      archive.append(fileStream, { name: nameInZip });
    }

    await archive.finalize();
  } catch (err) {
    console.error("Erreur downloadArchive:", err);
    res.status(500).json({
      success: false,
      message: "Erreur lors du téléchargement de l’archive",
      error: err.message,
    });
  }
};

exports.getSignedUrl = async (req, res) => {
  try {
    const year = req.params.year;
    const tempZipKey = `archives/${year}/archive_${year}_temp.zip`;

    // 1️⃣ Vérifier si le ZIP temporaire existe déjà
    const exists = await objectExistsInB2(tempZipKey);
    if (exists) {
      const url = s3.getSignedUrl('getObject', {
        Bucket: process.env.B2_BUCKET_NAME,
        Key: tempZipKey,
        Expires: 60 * 10 // 10 minutes
      });
      return res.json({ url });
    }

    // 2️⃣ Lister tous les fichiers de l'année
    const list = await s3.listObjectsV2({
      Bucket: process.env.B2_BUCKET_NAME,
      Prefix: `archives/${year}/`
    }).promise();

    if (!list.Contents || list.Contents.length === 0) {
      return res.status(404).json({ message: "Aucun fichier trouvé pour cette année" });
    }

    // 3️⃣ Créer un archive ZIP en mémoire
    const archiveStream = new stream.PassThrough();
    const uploadPromise = s3.upload({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: tempZipKey,
      Body: archiveStream,
      ContentType: 'application/zip'
    }).promise();

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', err => { throw err; });
    archive.pipe(archiveStream);

    for (const obj of list.Contents) {
      const key = obj.Key;
      const nameInZip = key.replace(`archives/${year}/`, '');
      const fileStream = s3.getObject({ Bucket: process.env.B2_BUCKET_NAME, Key: key }).createReadStream();
      archive.append(fileStream, { name: nameInZip });
    }

    await archive.finalize();
    await uploadPromise; // attendre que le ZIP soit uploadé sur B2

    // 4️⃣ Générer le signed URL
    const url = s3.getSignedUrl('getObject', {
      Bucket: process.env.B2_BUCKET_NAME,
      Key: tempZipKey,
      Expires: 60 * 10 // 10 minutes
    });

    res.json({ url });

  } catch (err) {
    console.error("❌ Erreur getSignedUrl:", err);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la génération du ZIP",
      error: err.message
    });
  }
};

