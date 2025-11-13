require('dotenv').config();
const db = require('../models/db');
const AWS = require('aws-sdk');
const path = require('path');
const mime = require('mime-types');
const archiver = require('archiver');
const pLimit = require('p-limit');
const stream = require('stream');
const { urlToB2Key, uploadBufferToB2 } = require('../helpers/archive.helpers');

const s3 = new AWS.S3({
  endpoint: process.env.B2_ENDPOINT,
  accessKeyId: process.env.B2_KEY_ID,
  secretAccessKey: process.env.B2_APP_KEY,
  region: process.env.B2_REGION,
  s3ForcePathStyle: true,
});

const CONCURRENCY = Number(process.env.ARCHIVE_CONCURRENCY || 5);

// Vérifie si un objet existe déjà sur B2
async function objectExistsInB2(key) {
  try {
    await s3.headObject({ Bucket: process.env.B2_BUCKET_NAME, Key: key }).promise();
    return true;
  } catch (err) {
    if (err.code === 'NotFound') return false;
    throw err;
  }
}

// Retries exponentiels
async function withRetries(fn, retries = 3, delay = 500) {
  for (let i = 0; i < retries; i++) {
    try { return await fn(); }
    catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, delay));
      delay *= 2;
    }
  }
}

// Courriers par année
async function fetchCourriersByYear(year, offset = 0, limit = 500) {
  const res = await db.query(`
    SELECT c.id AS courrier_id, c.numero_enregistrement, c.fichier_scan,
           i.id AS imputation_id, i.fichier_imputation
    FROM courriers c
    LEFT JOIN imputations i ON i.courrier_id = c.id
    WHERE EXTRACT(YEAR FROM c.date_reception) = $1
    ORDER BY c.numero_enregistrement
    OFFSET $2 LIMIT $3
  `, [year, offset, limit]);
  return res.rows;
}

// Transmissions pour une imputation
async function getTransmissionsForImputation(imputationId) {
  if (!imputationId) return [];
  const res = await db.query(
    `SELECT id, fichier_bordereau FROM transmissions_imputation WHERE imputation_id = $1`,
    [imputationId]
  );
  return res.rows || [];
}

// Télécharger un objet B2
async function getObjectFromB2(key) {
  return s3.getObject({ Bucket: process.env.B2_BUCKET_NAME, Key: key }).promise();
}

/* ================================
   Lancer archivage (POST)
================================ */
exports.launchArchive = async (req, res) => {
  const year = parseInt(req.params.year, 10);
  const userId = req.user?.id || null;

  try {
    const { rows } = await db.query(
      `INSERT INTO archives_runs (year, started_by, status) VALUES ($1, $2, 'in_progress') RETURNING id`,
      [year, userId]
    );
    const runId = rows[0].id;

    setImmediate(async () => {
      try {
        await archiveYearProcess(year, runId);
        await db.query(`UPDATE archives_runs SET status='done', finished_at=NOW() WHERE id=$1`, [runId]);
      } catch (err) {
        console.error(err);
        await db.query(`UPDATE archives_runs SET status='error', errors_count=errors_count+1 WHERE id=$1`, [runId]);
      }
    });

    return res.status(202).json({ message: `Archivage lancé`,
        jobId: runId,
        run_id: runId,
        id: runId,
        status: 'in_progress'
    });
    
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erreur de lancement", details: err.message });
  }
};

/* ================================
   Statut archivage (GET)
================================ */
exports.getArchiveStatus = async (req, res) => {
  const year = parseInt(req.params.year, 10);
  try {
    const { rows } = await db.query(
      `SELECT * FROM archives_runs WHERE year=$1 ORDER BY created_at DESC LIMIT 1`,
      [year]
    );
    if (!rows.length) return res.status(200).json({ status: 'not_started', message: `Aucune archive pour ${year}` });
    return res.status(200).json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: 'error', message: 'Erreur récupération statut', error: err.message });
  }
};

/* ================================
   Processus principal d’archivage
================================ */
async function archiveYearProcess(year, runId) {
  let offset = 0, limit = 500;
  const limitConcurrency = pLimit(CONCURRENCY);
  const errors = [];

  while (true) {
    const courriers = await fetchCourriersByYear(year, offset, limit);
    if (!courriers.length) break;

    const tasks = courriers.map(c => limitConcurrency(async () => {
      const dossierPrefix = `archives/${year}/courrier_${c.numero_enregistrement}_${c.courrier_id}/`;
      const toArchive = [];

      // Fichiers courrier
      let fichiersCourrier = [];
      try { fichiersCourrier = Array.isArray(c.fichier_scan) ? c.fichier_scan : JSON.parse(c.fichier_scan); }
      catch { fichiersCourrier = c.fichier_scan ? [c.fichier_scan] : []; }
      fichiersCourrier.forEach(fUrl => toArchive.push({ src: fUrl, destName: `01_courrier_${c.courrier_id}_${path.basename(fUrl)}` }));

      // Bordereau imputation
      if (c.fichier_imputation) toArchive.push({ src: c.fichier_imputation, destName: `02_bordereau_imputation_${c.imputation_id || 'NA'}.pdf` });

      // Transmissions
      const transmissions = await getTransmissionsForImputation(c.imputation_id);
      transmissions.forEach(t => { if (t.fichier_bordereau) toArchive.push({ src: t.fichier_bordereau, destName: `03_transmission_${t.id}.pdf` }); });

      // Upload B2
      for (const f of toArchive) {
        try {
          const key = urlToB2Key(f.src);
          const b2Key = `${dossierPrefix}${f.destName}`;
          if (await objectExistsInB2(b2Key)) continue;
          const s3Obj = await withRetries(() => getObjectFromB2(decodeURIComponent(key)));
          const contentType = s3Obj.ContentType || mime.lookup(f.destName) || 'application/octet-stream';
          await withRetries(() => uploadBufferToB2(s3Obj.Body, b2Key, contentType));
        } catch (err) { errors.push({ courrier_id: c.courrier_id, file: f.src, error: err.message }); }
      }
    }));

    await Promise.all(tasks);
    offset += limit;
  }

  if (errors.length) {
    await db.query(`UPDATE archives_runs SET errors=$1, errors_count=$2 WHERE id=$3`,
      [JSON.stringify(errors), errors.length, runId]);
  }
}

/* ================================
   Lien signé ZIP (GET)
================================ */
exports.getSignedUrl = async (req, res) => {
  try {
    const year = req.params.year;
    const tempZipKey = `archives/${year}/archive_${year}_temp.zip`;
    const exists = await objectExistsInB2(tempZipKey);

    if (exists) {
      const url = s3.getSignedUrl('getObject', { Bucket: process.env.B2_BUCKET_NAME, Key: tempZipKey, Expires: 600 });
      return res.json({ url });
    }

    const list = await s3.listObjectsV2({ Bucket: process.env.B2_BUCKET_NAME, Prefix: `archives/${year}/` }).promise();
    if (!list.Contents || list.Contents.length === 0) return res.status(404).json({ message: "Aucun fichier trouvé" });

    const archiveStream = new stream.PassThrough();
    const uploadPromise = s3.upload({ Bucket: process.env.B2_BUCKET_NAME, Key: tempZipKey, Body: archiveStream, ContentType: 'application/zip' }).promise();
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(archiveStream);

    for (const obj of list.Contents) {
      const key = obj.Key;
      const fileStream = s3.getObject({ Bucket: process.env.B2_BUCKET_NAME, Key: key }).createReadStream();
      archive.append(fileStream, { name: key.replace(`archives/${year}/`, '') });
    }

    await archive.finalize();
    await uploadPromise;

    const url = s3.getSignedUrl('getObject', { Bucket: process.env.B2_BUCKET_NAME, Key: tempZipKey, Expires: 600 });
    return res.json({ url });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Erreur génération ZIP", error: err.message });
  }
};

/* ================================
   Télécharger archive ZIP (GET)
================================ */
exports.downloadArchive = async (req, res) => {
  try {
    const year = req.params.year;
    const tempZipKey = `archives/${year}/archive_${year}_temp.zip`;
    const exists = await objectExistsInB2(tempZipKey);

    if (!exists) return res.status(404).json({ message: "Archive non trouvée" });

    const s3Stream = s3.getObject({ Bucket: process.env.B2_BUCKET_NAME, Key: tempZipKey }).createReadStream();
    res.setHeader('Content-Disposition', `attachment; filename=archive_${year}.zip`);
    res.setHeader('Content-Type', 'application/zip');
    s3Stream.pipe(res);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Erreur téléchargement ZIP", error: err.message });
  }
};
