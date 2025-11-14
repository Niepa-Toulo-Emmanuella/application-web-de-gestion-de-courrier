// archive.controller.js
const path = require('path');
const db = require('../models/db');
const { s3, uploadToB2, updateYearZip } = require('../helpers/archive.helpers');

/** Récupère la key B2 à partir d'une URL */
function extractKeyFromUrl(url) {
  const parts = url.split(".backblazeb2.com/");
  if (parts.length < 2) return null;

  let key = decodeURIComponent(parts[1]); // décode les espaces %20

  // retirer le nom du bucket au début si présent
  if (key.startsWith(process.env.B2_BUCKET_NAME + "/")) {
    key = key.replace(process.env.B2_BUCKET_NAME + "/", "");
  }

  return key;
}


/** Télécharge depuis B2 puis ré-upload vers un autre dossier B2 */
async function copyFileInB2(fileUrl, destKey) {
  const sourceKey = extractKeyFromUrl(fileUrl);
  if (!sourceKey) throw new Error(`Impossible d'extraire la key depuis ${fileUrl}`);

  try {
    // Télécharger depuis B2
    const fileStream = s3.getObject({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: sourceKey
    }).createReadStream();

    // Ré-upload vers dossier archive
    await s3.upload({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: destKey,
      Body: fileStream,
      ContentType: 'application/octet-stream'
    }).promise();

    console.log(`✅ Copié ${sourceKey} → ${destKey}`);
  } catch (err) {
    console.error(`❌ Erreur copyFileInB2 pour ${fileUrl}`, err.message);
  }
}


/**
 * Archive un courrier avec tous ses fichiers associés (bordereaux + imputations)
 */
async function archiveSingleCourrier(courrierId) {

  const courrierRes = await db.query(`
    SELECT id, numero_enregistrement, date_reception, fichier_scan
    FROM courriers
    WHERE id = $1
  `, [courrierId]);

  if (!courrierRes.rows.length) return;
  const courrier = courrierRes.rows[0];

  const year = new Date(courrier.date_reception).getFullYear();
  const dossierYear = `archives/${year}/`;
  const dossierCourrier = `${dossierYear}${courrier.numero_enregistrement}/`;

  // ----------------------
  // 📌 1️⃣ ARCHIVER SCANS
  // ----------------------
  let fichiersCourrier = [];

  try {
    fichiersCourrier = Array.isArray(courrier.fichier_scan)
      ? courrier.fichier_scan
      : JSON.parse(courrier.fichier_scan);
  } catch {
    fichiersCourrier = courrier.fichier_scan ? [courrier.fichier_scan] : [];
  }

  for (const fichier of fichiersCourrier) {
    const fileName = path.basename(fichier);
    await copyFileInB2(fichier, `${dossierCourrier}${fileName}`);
  }

  // ------------------------
  // 📌 2️⃣ ARCHIVER BORDEREAUX
  // ------------------------
  const bordereauxRes = await db.query(`
    SELECT id AS bordereau_id, fichier_bordereau
    FROM bordereaux
    WHERE courrier_id = $1
  `, [courrierId]);

  for (const bord of bordereauxRes.rows) {

    // Bordereau PDF
    if (bord.fichier_bordereau) {
      const fileName = path.basename(bord.fichier_bordereau);
      await copyFileInB2(bord.fichier_bordereau, `${dossierCourrier}${fileName}`);
    }

    // ------------------------
    // 📌 3️⃣ ARCHIVER IMPUTATIONS
    // ------------------------
    const imputationsRes = await db.query(`
      SELECT fichier_imputation
      FROM imputations
      WHERE bordereau_id = $1
    `, [bord.bordereau_id]);

    for (const imp of imputationsRes.rows) {
      if (imp.fichier_imputation) {
        const fileName = path.basename(imp.fichier_imputation);
        await copyFileInB2(imp.fichier_imputation, `${dossierCourrier}${fileName}`);
      }
    }
  }

  // 📦 4️⃣ Mise à jour du ZIP annuel
  await updateYearZip(year);
}

module.exports = { archiveSingleCourrier };
