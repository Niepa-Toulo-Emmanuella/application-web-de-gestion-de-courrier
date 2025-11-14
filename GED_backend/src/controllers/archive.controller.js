// archive.controller.js
const path = require('path');
const db = require('../models/db');
const { s3, updateYearZip } = require('../helpers/archive.helpers');
const mime = require('mime-types');


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


/** Télécharge depuis B2 puis ré-upload vers un autre dossier avec MIME correct */
async function copyFileInB2(fileUrl, destKey) {
  const sourceKey = extractKeyFromUrl(fileUrl);
  if (!sourceKey) throw new Error(`Impossible d'extraire la key depuis ${fileUrl}`);

  try {
    // Télécharger depuis B2
    const fileStream = s3.getObject({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: sourceKey
    }).createReadStream();

    // Déterminer le MIME type
    const contentType = mime.lookup(sourceKey) || 'application/octet-stream';

    // Ré-upload vers dossier archive
    await s3.upload({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: destKey,
      Body: fileStream,
      ContentType: contentType
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

/** Récupère la key B2 ou le chemin relatif pour un bordereau de transmission */
function extractBordereauKey(filePath) {
  if (!filePath) return null;

  // Si c'est déjà un chemin relatif, retourne tel quel
  if (!filePath.includes(".backblazeb2.com")) {
    return filePath;
  }

  const parts = filePath.split(".backblazeb2.com/");
  if (parts.length < 2) return null;

  let key = decodeURIComponent(parts[1]); // décode les espaces %20

  // retirer le nom du bucket au début si présent
  if (key.startsWith(process.env.B2_BUCKET_NAME + "/")) {
    key = key.replace(process.env.B2_BUCKET_NAME + "/", "");
  }

  return key;
}


async function copyBordereauInB2(fileUrl, destKey) {
  const sourceKey = extractBordereauKey(fileUrl);
  if (!sourceKey) throw new Error(`Impossible d'extraire la key depuis ${fileUrl}`);

  try {
    const fileStream = s3.getObject({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: sourceKey
    }).createReadStream();

    const contentType = mime.lookup(sourceKey) || 'application/pdf'; // PDF par défaut

    await s3.upload({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: destKey,
      Body: fileStream,
      ContentType: contentType
    }).promise();

    console.log(`✅ Copié ${sourceKey} → ${destKey}`);
  } catch (err) {
    console.error(`❌ Erreur copyBordereauInB2 pour ${fileUrl}`, err.message);
  }
}


/** Archive uniquement le PDF d’un bordereau de transmission + met à jour le ZIP annuel */
async function archiveBordereau(bordereauId) {
  // 1️⃣ Récupérer le bordereau
  const bordRes = await db.query(`SELECT * FROM bordereaux WHERE id = $1`, [bordereauId]);
  if (!bordRes.rows.length) return;
  const bord = bordRes.rows[0];

  // 2️⃣ Récupérer le courrier parent pour connaître l'année et le numéro
  const courrierRes = await db.query(
    `SELECT numero_enregistrement, date_reception FROM courriers WHERE id = $1`,
    [bord.courrier_id]
  );
  if (!courrierRes.rows.length) return;
  const courrier = courrierRes.rows[0];

  const year = new Date(courrier.date_reception).getFullYear();
  const dossierCourrier = `archives/${year}/${courrier.numero_enregistrement}/`;

  // 3️⃣ Copier uniquement le PDF du bordereau
  if (bord.fichier_bordereau) {
    const fileName = path.basename(bord.fichier_bordereau);
    await copyBordereauInB2(bord.fichier_bordereau, `${dossierCourrier}${fileName}`);

  }

  // 4️⃣ Mettre à jour le ZIP annuel
  await updateYearZip(year);
}




// ---------------------- Gestion B2 pour les imputations ----------------------

/** Récupère la key B2 ou le chemin relatif pour un PDF d’imputation */
function extractImputationKey(filePath) {
  if (!filePath) return null;

  // Si c'est déjà un chemin relatif, retourne tel quel
  if (!filePath.includes(".backblazeb2.com")) {
    return filePath;
  }

  const parts = filePath.split(".backblazeb2.com/");
  if (parts.length < 2) return null;

  let key = decodeURIComponent(parts[1]); // décode les espaces %20

  // retirer le nom du bucket au début si présent
  if (key.startsWith(process.env.B2_BUCKET_NAME + "/")) {
    key = key.replace(process.env.B2_BUCKET_NAME + "/", "");
  }

  return key;
}

/** Copie un PDF d’imputation dans B2 */
async function copyImputationInB2(fileUrl, destKey) {
  const sourceKey = extractImputationKey(fileUrl);
  if (!sourceKey) throw new Error(`Impossible d'extraire la key depuis ${fileUrl}`);

  try {
    const fileStream = s3.getObject({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: sourceKey
    }).createReadStream();

    const contentType = mime.lookup(sourceKey) || 'application/pdf';

    await s3.upload({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: destKey,
      Body: fileStream,
      ContentType: contentType
    }).promise();

    console.log(`✅ Copié ${sourceKey} → ${destKey}`);
  } catch (err) {
    console.error(`❌ Erreur copyImputationInB2 pour ${fileUrl}`, err.message);
  }
}

/** Archive uniquement le PDF d’une imputation + met à jour la DB */
async function archiveImputation(imputationId) {
  // 1️⃣ Récupérer l’imputation
  const impRes = await db.query(`SELECT * FROM imputations WHERE id = $1`, [imputationId]);
  if (!impRes.rows.length) return;
  const imp = impRes.rows[0];

  // 2️⃣ Récupérer le courrier parent pour connaître l'année et le numéro
  const courrierRes = await db.query(
    `SELECT numero_enregistrement, date_arrivee FROM courriers WHERE id = $1`,
    [imp.courrier_id]
  );
  if (!courrierRes.rows.length) return;
  const courrier = courrierRes.rows[0];

  const year = new Date(courrier.date_arrivee).getFullYear();
  const dossierCourrier = `archives/${year}/${courrier.numero_enregistrement}/`;

  // 3️⃣ Copier uniquement le PDF d’imputation
  if (imp.fichier_imputation) {
    const fileName = path.basename(imp.fichier_imputation);
    await copyImputationInB2(imp.fichier_imputation, `${dossierCourrier}${fileName}`);
  }

  // 4️⃣ Mettre à jour la DB pour marquer comme archivé
  await db.query(
    `UPDATE imputations SET statut = 'archive', fichier_imputation = $1 WHERE id = $2`,
    [`${dossierCourrier}${path.basename(imp.fichier_imputation)}`, imputationId]
  );

  console.log(`✅ Imputation ${imputationId} archivée`);
}



module.exports = { copyFileInB2, archiveSingleCourrier, copyBordereauInB2, archiveBordereau, extractImputationKey, copyImputationInB2, archiveImputation };
