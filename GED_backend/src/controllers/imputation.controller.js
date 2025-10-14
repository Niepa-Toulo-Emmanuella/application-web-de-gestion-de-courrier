const db = require('../models/db');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const AWS = require('aws-sdk');

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

  html = html.replace(/{{IMPUTATION_ID}}/g, data.imputation_id || '')
             .replace(/{{BORDEREAU_ID}}/g, data.bordereau_id || '')
             .replace(/{{INSTRUCTIONS}}/g, data.instructions || '')
             .replace(/{{DATE_DEPART}}/g, data.date_depart || '')
             .replace(/{{DUREE_TRAITEMENT}}/g, data.duree_traitement || '')
             .replace(/{{DATE_RETOUR}}/g, data.date_retour || '')
             .replace(/{{TRAITEMENT_ACTIONS}}/g, data.traitement_actions || '')
             .replace(/{{OBSERVATIONS}}/g, data.observations || '');

  const filePath = `temp_imputation_${Date.now()}.pdf`;

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.pdf({ path: filePath, format: 'A4', printBackground: true });
  await browser.close();

  return filePath;
}


// Créer un bordereau d’imputation
exports.create = async (req, res) => {
  try {
    // ✅ Récupération des données depuis req.body
    const {
      bordereau_id,
      premiere_transmission,
      imputations,
      instructions,
      date_depart,
      duree_traitement,
      date_retour,
      traitement_actions,
      observations,
      destinataire_id // on suppose que le frontend l’envoie
    } = req.body;

    // ✅ Expéditeur : utilisateur connecté
    const expediteur_id = req.user?.id || req.user?.userId;

    console.log("🧾 Corps reçu :", req.body);

    // 1️⃣ Génération du PDF
    const pdfPath = await generateImputationPDF({
      bordereau_id,
      instructions,
      date_depart,
      duree_traitement,
      date_retour,
      traitement_actions,
      observations
    });

    // 2️⃣ Upload sur B2
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

    // 3️⃣ Récupérer le courrier lié au bordereau
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
        (bordereau_id, premiere_transmission, imputations, courrier_id, expediteur_id, destinataire_id, instructions, date_depart, duree_traitement, date_retour, traitement_actions, observations, fichier_imputation)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        bordereau_id,
        premiere_transmission,
        imputations,
        courrier_id,
        expediteur_id,
        destinataire_id,
        instructions,
        date_depart,
        duree_traitement,
        date_retour,
        traitement_actions,
        observations,
        fichier_imputation
      ]
    );

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

    const { imputation_id, destinataire_id, instructions, duree_traitement, observations } = req.body;

    console.log("📤 Transmission :", { expediteur_id, imputation_id, destinataire_id });

    const result = await db.query(
      `INSERT INTO transmissions_imputation
        (imputation_id, destinataire_id, expediteur_id, instructions, duree_traitement, observations)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [imputation_id, destinataire_id, expediteur_id, instructions, duree_traitement, observations]
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
    const result = await db.query('SELECT * FROM imputations ORDER BY id DESC');
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
