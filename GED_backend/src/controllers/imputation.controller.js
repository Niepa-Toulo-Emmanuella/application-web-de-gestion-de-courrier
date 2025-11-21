// imputation.controller.js

const db = require('../models/db');
const path = require('path');
const fs = require('fs');
const AWS = require('aws-sdk');
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); // dossier temporaire pour cachets
const { archiveImputation } = require('../controllers/archive.controller');


// S3 B2
const s3 = new AWS.S3({
  endpoint: process.env.B2_ENDPOINT,
  accessKeyId: process.env.B2_KEY_ID,
  secretAccessKey: process.env.B2_APP_KEY,
});

// Générer un PDF à partir d'un template HTML pour une imputation
async function generateImputationPDF(data) {
  const templatePath = path.join(__dirname, '../templates/imputation_template.html');

  console.log(templatePath); // pour vérifier que le chemin est correct
  let html = fs.readFileSync(templatePath, 'utf-8');

 // Remplacer les champs simples
  html = html.replace(/{{INSTRUCTIONS_TEXT}}/g, (data.instructions || []).join(', '))
            //  .replace(/{{DATE_DEPART}}/g, data.date_depart || '')
            //  .replace(/{{DUREE_TRAITEMENT}}/g, data.duree_traitement || '')
            //  .replace(/{{DATE_RETOUR}}/g, data.date_retour || '')
            //  .replace(/{{TRAITEMENT_ACTIONS_TEXT}}/g, (data.traitement_actions || []).join(', '))
             .replace(/{{OBSERVATIONS}}/g, data.observations || '')
             .replace(/{{INSTRUCTIONS_SUP}}/g, data.instructions_sup || '');

  // ---------- SIGNATURE et CACHET : utiliser data URLs ----------
  // data.signature attendu sous la forme "data:image/png;base64,...." ou seulement base64 (on normalise)
  function normalizeToDataUrl(maybeData) {
    if (!maybeData) return null;
    if (maybeData.startsWith('data:image')) return maybeData; // déjà data url
    // sinon on suppose que c'est du base64 pur (début "iVBORw0..." ou " /9j/4AAQ...")
    return 'data:image/png;base64,' + maybeData.replace(/^data:image\/\w+;base64,/, '');
  }

  const signatureDataUrl = normalizeToDataUrl(data.signature);
  const cachetDataUrl = normalizeToDataUrl(data.cachet);

  console.log("🖊️ Signature présente ?", !!signatureDataUrl);
  console.log("🏷️ Cachet présent ?", !!cachetDataUrl);

  // Remplacer placeholders par <img> avec data URLs ou par une image vide si absent
  if (signatureDataUrl) {
    html = html.replace(/{{SIGNATURE}}/g, signatureDataUrl);
  } else {
    // si tu veux une image de fallback, remplace par un petit transparent 1x1
    html = html.replace(/{{SIGNATURE}}/g, '');
  }

  if (cachetDataUrl) {
    html = html.replace(/{{CACHET}}/g, cachetDataUrl);
  } else {
    html = html.replace(/{{CACHET}}/g, '');
  }
  

  // 🧩 Helper : normalise les textes pour comparer sans accent / casse
  function normalizeText(s) {
    if (!s) return "";
    return s
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // enlève les accents
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  // 🗂️ Définition de toutes les cases à cocher avec leur section
  const checkboxDefs = [
    // I. Première transmission
    { label: "MINISTRE", placeholder: "CHECK_MINISTRE", section: "premiere_transmission" },
    { label: "Pour information", placeholder: "CHECK_POUR_INFORMATION", section: "premiere_transmission" },
    { label: "Pour avis", placeholder: "CHECK_POUR_AVIS", section: "premiere_transmission" },
    { label: "Autres", placeholder: "CHECK_AUTRES_PREMIERE_TRANSMISSION", section: "premiere_transmission" },

    // II. Imputation du courrier
    { label: "Directeur de Cabinet", placeholder: "CHECK_DIRECTEUR_DE_CABINET", section: "imputations" },
    { label: "DJSRH", placeholder: "CHECK_DJSRH", section: "imputations" },
    { label: "Directeur de Cabinet Adjoint", placeholder: "CHECK_DIRECTEUR_DE_CABINET_ADJOINT", section: "imputations" },
    { label: "IGSJP", placeholder: "CHECK_IGSJP", section: "imputations" },
    { label: "Chef de Cabinet", placeholder: "CHECK_CHEF_DE_CABINET", section: "imputations" },
    { label: "Conseiller Tech", placeholder: "CHECK_CONSEILLER_TECH", section: "imputations" },
    { label: "Chargé d’Études", placeholder: "CHECK_CHARGE_D_ETUDES", section: "imputations" },
    { label: "Secrétariat Particulier", placeholder: "CHECK_SECRETARIAT_PARTICULIER", section: "imputations" },
    { label: "JACP", placeholder: "CHECK_JACP", section: "imputations" },
    { label: "Directeur", placeholder: "CHECK_DIRECTEUR", section: "imputations" },
    { label: "1er Président", placeholder: "CHECK_1ER_PRESIDENT", section: "imputations" },
    { label: "Président", placeholder: "CHECK_PRESIDENT", section: "imputations" },
    { label: "Procureur", placeholder: "CHECK_PROCUREUR", section: "imputations" },
    { label: "Service", placeholder: "CHECK_SERVICE", section: "imputations" },
    { label: "Assistant du Ministre", placeholder: "CHECK_ASSISTANT_DU_MINISTRE", section: "imputations" },
    { label: "Chef Protocole", placeholder: "CHECK_CHEF_PROTOCOLE", section: "imputations" },
    { label: "Chargé de Mission", placeholder: "CHECK_CHARGE_DE_MISSION", section: "imputations" },
    { label: "Autres", placeholder: "CHECK_AUTRES_IMPUTATION", section: "imputations" },

    // III. Instructions
    { label: "Urgence 24h", placeholder: "CHECK_URGENCE_24H", section: "instructions" },
    { label: "Attribution", placeholder: "CHECK_ATTRIBUTION", section: "instructions" },
    { label: "Avis", placeholder: "CHECK_AVIS", section: "instructions" },
    { label: "Étude", placeholder: "CHECK_ETUDE", section: "instructions" },
    { label: "Synthèse", placeholder: "CHECK_SYNTHESE", section: "instructions" },
    { label: "Mémo", placeholder: "CHECK_MEMO", section: "instructions" },
    { label: "Classement", placeholder: "CHECK_CLASSEMENT", section: "instructions" },
    { label: "Classement en attente", placeholder: "CHECK_CLASSEMENT_EN_ATTENTE_INSTRUCTIONS", section: "instructions" },
    { label: "Diffusion", placeholder: "CHECK_DIFFUSION", section: "instructions" },
    { label: "Réponse", placeholder: "CHECK_REPONSE", section: "instructions" },
    { label: "Représentation", placeholder: "CHECK_REPRESENTATION", section: "instructions" },
    { label: "Information", placeholder: "CHECK_INFORMATION", section: "instructions" },
    { label: "Suivi", placeholder: "CHECK_SUIVI", section: "instructions" },
    { label: "Classement définitif", placeholder: "CHECK_CLASSEMENT_DEFINITIF_INSTRUCTIONS", section: "instructions" },
    { label: "Proposition", placeholder: "CHECK_PROPOSITION", section: "instructions" },
    { label: "Me voir", placeholder: "CHECK_ME_VOIR", section: "instructions" },
    { label: "Rapport", placeholder: "CHECK_RAPPORT", section: "instructions" },
    { label: "Notes au Ministre", placeholder: "CHECK_NOTES_AU_MINISTRE", section: "instructions" },
    { label: "Exécution", placeholder: "CHECK_EXECUTION_INSTRUCTIONS", section: "instructions" },
    { label: "Courrier de transmission", placeholder: "CHECK_COURRIER_DE_TRANSMISSION", section: "instructions" },
    { label: "Soit Transmis", placeholder: "CHECK_SOIT_TRANSMIS", section: "instructions" },

    // IV. Deuxième traitement du ministre
    // { label: "Classement définitif", placeholder: "CHECK_CLASSEMENT_DEFINITIF_DEUXIEME_TRAITEMENT", section: "traitement_actions" },
    // { label: "Classement en attente", placeholder: "CHECK_CLASSEMENT_EN_ATTENTE_DEUXIEME_TRAITEMENT", section: "traitement_actions" },
    // { label: "Exécution", placeholder: "CHECK_EXECUTION_DEUXIEME_TRAITEMENT", section: "traitement_actions" },
    // { label: "RDV", placeholder: "CHECK_RDV", section: "traitement_actions" },
    // { label: "Audience", placeholder: "CHECK_AUDIENCE", section: "traitement_actions" },
    // { label: "Autres", placeholder: "CHECK_AUTRES_DEUXIEME_TRAITEMENT", section: "traitement_actions" }
  ];

  // 🧾 Remplacement des placeholders selon la section correspondante
  checkboxDefs.forEach(def => {
    let sourceArray = [];

    switch (def.section) {
      case "premiere_transmission":
        sourceArray = data.premiere_transmission || [];
        break;
      case "imputations":
        sourceArray = data.imputations || [];
        break;
      case "instructions":
        sourceArray = data.instructions || [];
        break;
      // case "traitement_actions":
      //   sourceArray = data.traitement_actions || [];
      //   break;
    }

    const isChecked =
      Array.isArray(sourceArray) &&
      sourceArray.some(v => normalizeText(v) === normalizeText(def.label));

    html = html.replace(new RegExp(`{{${def.placeholder}}}`, "g"), isChecked ? "checked" : "");
  });


  const filePath = `temp_imputation_${Date.now()}.pdf`;

  console.log("🚀 Lancement Puppeteer pour générer PDF...");

  // ✅ Lancer Puppeteer avec Chromium intégré (compatible Render)
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });

  
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.pdf({ path: filePath, format: 'A4', printBackground: true });
  await browser.close();

  console.log("✅ PDF généré :", filePath);

  return filePath;
}


// Créer un bordereau d’imputation
// imputation.controller.js (extrait simplifié pour create)

exports.create = async (req, res) => {
  try {
    const {
      bordereau_id,
      premiere_transmission,
      imputations,
      instructions,
      observations,
      instructions_sup,
      signature, // base64 / data URL venant du front
      cachet,    // base64 / data URL venant du front
      destinataire_id,
      priorite
    } = req.body;

    const expediteur_id = req.user?.id || req.user?.userId;

    console.log("🖊️ Signature présente ?", !!signature);
    console.log("🏷️ Cachet présent ?", !!cachet);

    // 1️⃣ Génération PDF
    const pdfPath = await generateImputationPDF({
      bordereau_id,
      premiere_transmission,
      imputations,
      instructions,
      observations,
      instructions_sup,
      signature, // déjà base64/data URL
      cachet
    });

    // 2️⃣ Upload PDF sur B2
    const fileContent = fs.readFileSync(pdfPath);
    const s3Params = {
      Bucket: process.env.B2_BUCKET_NAME,
      Key: `imputations/${Date.now()}_imputation.pdf`,
      Body: fileContent,
      ContentType: 'application/pdf',
    };
    await s3.upload(s3Params).promise();
    fs.unlinkSync(pdfPath);
    const fichier_imputation = s3Params.Key;

    // 3️⃣ Récupérer le courrier lié
    let courrier_id = null;
    if (bordereau_id) {
      const courrierResult = await db.query(
        "SELECT courrier_id FROM bordereaux WHERE id = $1",
        [bordereau_id]
      );
      courrier_id = courrierResult.rows[0]?.courrier_id || null;
    }

    // 4️⃣ Insertion en DB
    const result = await db.query(
      `INSERT INTO imputations 
        (bordereau_id, premiere_transmission, imputations, courrier_id, expediteur_id, instructions, observations, instructions_sup, fichier_imputation, priorite)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        bordereau_id,
        premiere_transmission,
        imputations,
        courrier_id,
        expediteur_id,
        instructions,
        observations,
        instructions_sup,
        fichier_imputation,
        priorite
      ]
    );

    // 5️⃣ Archiver automatiquement le PDF
    await archiveImputation(result.rows[0].id);

    res.status(201).json({ success: true, data: result.rows[0], message: "Imputation enregistrée avec PDF ✅" });
  } catch (err) {
    console.error("Erreur création imputation :", err);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
};



exports.createTransmission = async (req, res) => {
  try {
    if (!req.user) {
      console.log("⚠️ req.user est undefined !");
      return res.status(401).json({ success: false, message: "Utilisateur non identifié" });
    }

    const expediteur_id = req.user.id || req.user._id || req.user.userId; // adapte selon ton User model

    const { imputation_id, destinataire_id } = req.body;

    // 1️⃣ Récupérer la priorité depuis la table imputations
    const imputationRes = await db.query(
      `SELECT priorite FROM imputations WHERE id = $1`,
      [imputation_id]
    );
    const priorite = imputationRes.rows[0]?.priorite || 'Normale';

    console.log("📤 Transmission :", { expediteur_id, imputation_id, destinataire_id });

    const result = await db.query(
      `INSERT INTO transmissions_imputation
        (imputation_id, destinataire_id, expediteur_id, priorite)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [imputation_id, destinataire_id, expediteur_id, priorite]
    );
    // 🟩 Mettre à jour le statut de la transmission
    await db.query(
      `UPDATE transmissions_imputation
      SET statut = 'envoye'
      WHERE id = $1`,
      [result.rows[0].id]
    );

    await db.query(
      `UPDATE imputations SET statut = 'envoye' WHERE id = $1`,
      [imputation_id]
    );


    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("Erreur createTransmission :", err);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
};


// Lister toutes les imputations (pour le select)
exports.getAll = async (req, res) => {
  try {
    const result = await db.query(
      `
      SELECT i.*, c.objet AS courrier_objet
      FROM imputations i
      LEFT JOIN courriers c ON c.id = i.courrier_id
      WHERE i.statut = 'en_attente'
      ORDER BY i.id DESC
    `
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
};

// Lister les transmissions pour une imputation
exports.getTransmissions = async (req, res) => {
  try {
    const imputationId = parseInt(req.params.id, 10);
    if (isNaN(imputationId)) {
      return res.status(400).json({ success: false, message: "ID d’imputation invalide" });
    }

    const result = await db.query(`
      SELECT t.*, 
             u.first_name || ' ' || u.last_name AS destinataire,
             e.first_name || ' ' || e.last_name AS expediteur_nom
      FROM transmissions_imputation t
      JOIN users u ON u.id = t.destinataire_id
      LEFT JOIN users e ON e.id = t.expediteur_id
      WHERE t.imputation_id = $1
      ORDER BY t.date_depart DESC
    `, [imputationId]);

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("Erreur getTransmissions:", err);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
};

// ---------- MODIFICATION : getTransmissionsForUser avec ta requête SQL (et destinations) ----------
// imputation.controller.js (remplacer la fonction getTransmissionsForUser par ceci)
exports.getTransmissionsForUser = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) {
      return res.status(400).json({ success: false, message: "ID utilisateur invalide" });
    }

    const q = `
      SELECT 
        ti.*,
        e.first_name AS expediteur_prenom,
        e.last_name  AS expediteur_nom,
        d.first_name AS destinataire_prenom,
        d.last_name  AS destinataire_nom,
        (e.first_name || ' ' || e.last_name) AS expediteur_fullname,
        (d.first_name || ' ' || d.last_name) AS destinataire_fullname,
        c.id    AS courrier_id,
        c.reference AS courrier_reference,
        c.objet  AS courrier_objet,
        c.date_arrivee AS courrier_date_arrivee,
        c.fichier_scan,
        b.fichier_bordereau,
        i.fichier_imputation
      FROM transmissions_imputation ti
      LEFT JOIN users e ON e.id = ti.expediteur_id
      LEFT JOIN users d ON d.id = ti.destinataire_id
      LEFT JOIN imputations i ON i.id = ti.imputation_id
      LEFT JOIN bordereaux b ON b.id = i.bordereau_id
      LEFT JOIN courriers c ON c.id = i.courrier_id
      WHERE ti.destinataire_id = $1
      ORDER BY ti.date_depart DESC;
    `;

    const result = await db.query(q, [userId]);
    
    // Assurer que tous les champs sont définis même s’ils sont nulls
    const data = result.rows.map(row => ({
      ...row,
      expediteur_fullname: row.expediteur_fullname || null,
      destinataire_fullname: row.destinataire_fullname || null,
      courrier_id: row.courrier_id || null,
      courrier_reference: row.courrier_reference || null,
      courrier_objet: row.courrier_objet || null,
      courrier_date_arrivee: row.courrier_date_arrivee || null,
      fichier_scan: row.fichier_scan || null,
      fichier_bordereau: row.fichier_bordereau || null,
      fichier_imputation: row.fichier_imputation || null
    }));

    res.json({ success: true, data });
  } catch (err) {
    console.error("Erreur getTransmissionsForUser:", err);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
};

exports.securePreviewByKey = async (req, res) => {
  try {
    const { key } = req.body;
    if (!key) return res.status(400).json({ success: false, message: "Clé introuvable" });

    // 🔒 Récupération depuis B2
    const file = await s3.getObject({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: key
    }).promise();

    res.setHeader('Content-Type', 'application/pdf');
    res.send(file.Body);
  } catch (err) {
    console.error("Erreur aperçu imputation :", err);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
};

