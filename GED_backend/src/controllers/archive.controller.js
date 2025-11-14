// archive.controller.js
const path = require('path');
const db = require('../models/db'); // ton module de connexion à la base
const { uploadToB2 } = require('../helpers/archive.helpers'); // fonction pour uploader sur B2

/**
 * Archive un courrier avec tous ses fichiers associés (bordereaux + imputations)
 * @param {number} courrierId - L'ID du courrier à archiver
 */
async function archiveSingleCourrier(courrierId) {
  // 1️⃣ Récupérer le courrier et ses fichiers
  const courrierRes = await db.query(`
    SELECT id, numero_enregistrement, date_reception, fichier_scan
    FROM courriers
    WHERE id = $1
  `, [courrierId]);

  if (!courrierRes.rows.length) return; // Si le courrier n'existe pas, on quitte

  const courrier = courrierRes.rows[0];

  // Déterminer l'année du courrier pour créer le dossier de l'année
  const year = new Date(courrier.date_reception).getFullYear();
  const dossierYear = `archives/${year}/`;
  // Chaque courrier a son propre dossier nommé avec son numéro d'enregistrement
  const dossierCourrier = `${dossierYear}${courrier.numero_enregistrement}/`;

  // 2️⃣ Archiver les fichiers du courrier
  let fichiersCourrier = [];
  try {
    fichiersCourrier = Array.isArray(courrier.fichier_scan) ? courrier.fichier_scan : JSON.parse(courrier.fichier_scan);
  } catch {
    fichiersCourrier = courrier.fichier_scan ? [courrier.fichier_scan] : [];
  }

  for (const fichier of fichiersCourrier) {
    // On garde le nom original du fichier
    const fileName = path.basename(fichier);
    await uploadToB2(fichier, `${dossierCourrier}${fileName}`);
  }

  // 3️⃣ Récupérer les bordereaux de transmission associés au courrier
  const bordereauxRes = await db.query(`
    SELECT id AS bordereau_id, fichier_bordereau
    FROM bordereaux
    WHERE courrier_id = $1
  `, [courrierId]);

  for (const bordereau of bordereauxRes.rows) {
    if (bordereau.fichier_bordereau) {
      const fileName = path.basename(bordereau.fichier_bordereau);
      await uploadToB2(bordereau.fichier_bordereau, `${dossierCourrier}${fileName}`);
    }

    // 4️⃣ Pour chaque bordereau, récupérer les imputations associées
    const imputationsRes = await db.query(`
      SELECT fichier_imputation
      FROM imputations
      WHERE bordereau_id = $1
    `, [bordereau.bordereau_id]);

    for (const imputation of imputationsRes.rows) {
      if (imputation.fichier_imputation) {
        const fileName = path.basename(imputation.fichier_imputation);
        await uploadToB2(imputation.fichier_imputation, `${dossierCourrier}${fileName}`);
      }
    }
  }
   // 4️⃣ Mettre à jour le ZIP annuel pour inclure ce courrier
  await updateYearZip(year);
}


module.exports = { archiveSingleCourrier };
