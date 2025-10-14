const db = require('../models/db');
const Bordereau = require('../models/Bordereau');
const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');
const puppeteer = require('puppeteer');

/* -------- Client S3 Backblaze B2 -------- */
const s3 = new AWS.S3({
  endpoint: process.env.B2_ENDPOINT,
  accessKeyId: process.env.B2_KEY_ID,
  secretAccessKey: process.env.B2_APP_KEY,
});

/* -------- Générateur automatique de numéro -------- */
function generateNumero() {
  const date = new Date();
  return `BDR-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${Date.now()}`;
}

/* -------- Générer le PDF depuis template HTML -------- */
async function generateBordereauPDF(data) {
  const templatePath = path.join(__dirname, '../templates/bordereau_template.html');


  console.log(templatePath); // pour vérifier que le chemin est correct
  let html = fs.readFileSync(templatePath, 'utf-8');

  // Remplacer les placeholders du template
  html = html.replace(/{{NUMERO}}/g, data.numero || '')
             .replace(/{{COURRIER}}/g, data.courrier || '')
             .replace(/{{FICHIER_SCAN}}/g, data.fichier_scan || '')
             .replace(/{{EXPEDITEUR}}/g, data.expediteur || '')
             .replace(/{{REFERENCE}}/g, data.numero_reference || '')
             .replace(/{{DATE_COURRIER}}/g, data.date_courrier || '')
             .replace(/{{DATE_ARRIVEE}}/g, data.date_arrivee || '')
             .replace(/{{NUMERO_ENREGISTREMENT}}/g, data.numero_enregistrement || '')
             .replace(/{{HEURE}}/g, data.heure || '')
             .replace(/{{OBJET}}/g, data.objet || '')
             .replace(/{{OBSERVATIONS}}/g, data.observations || '');

  const filePath = `temp_bordereau_${Date.now()}.pdf`;

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.pdf({ path: filePath, format: 'A4', printBackground: true });
  await browser.close();

  return filePath;
}

/* ---------------- LISTE -------------------------------------- */
exports.list = async (_req, res) => {
  try {
    const data = await Bordereau.findAll();
    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

/* ---------------- DETAIL ------------------------------------- */
exports.detail = async (req, res) => {
  try {
    const row = await Bordereau.findById(req.params.id);
    if (!row)
      return res.status(404).json({ success: false, message: 'Introuvable' });

    res.json({ success: true, data: row });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ---------------- CREATE -------------------------------------
exports.create = async (req, res) => {
  try {
    const {
      courrier_id, expediteur_id, destinataire_id, numero_reference, date_courrier,
      date_arrivee, numero_enregistrement, heure, objet, observations
    } = req.body;

    if (!courrier_id) {
      return res.status(400).json({ success: false, message: "courrier_id est requis" });
    }

    // Vérifier que le courrier existe
    const courrierRes = await db.query(
      `SELECT id, fichier_scan, objet FROM courriers WHERE id = $1`,
      [courrier_id]
    );
    if (courrierRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Courrier introuvable" });
    }
    const courrier = courrierRes.rows[0];

    const numero = generateNumero();

    // 1️⃣ Génération du PDF à partir du template
    const pdfPath = await generateBordereauPDF({
      numero,
      courrier: `Courrier #${courrier.id}`,
      fichier_scan: courrier.fichier_scan,
      expediteur: expediteur_id,
      numero_reference,
      date_courrier,
      date_arrivee,
      numero_enregistrement,
      heure,
      objet,
      observations
    });

    // 2️⃣ Upload sur B2
    const fileContent = fs.readFileSync(pdfPath);
    const s3Params = {
      Bucket: process.env.B2_BUCKET_NAME,
      Key: `bordereaux/${Date.now()}_bordereau.pdf`,
      Body: fileContent,
      ContentType: 'application/pdf',
    };
    const uploaded = await s3.upload(s3Params).promise();
    fs.unlinkSync(pdfPath); // supprimer le fichier temporaire

    const fichier_bordereau = s3Params.Key;

    // 3️⃣ Insertion en DB
    const result = await db.query(`
      INSERT INTO bordereaux (
        courrier_id, expediteur_id, destinataire_id, numero_reference, date_courrier,
        date_arrivee, numero_enregistrement, heure, objet, observations,
        statut, numero, fichier_bordereau
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'en_attente',$11,$12)
      RETURNING *;
    `, [
      courrier_id,
      expediteur_id,
      destinataire_id || null,
      numero_reference,
      date_courrier,
      date_arrivee,
      numero_enregistrement,
      heure,
      objet,
      observations,
      numero,
      fichier_bordereau
    ]);

    const bordereau = result.rows[0];

    res.status(201).json({
      success: true,
      message: "Bordereau enregistré et PDF généré avec succès ✅",
      data: { bordereau, courrier }
    });

  } catch (err) {
    console.error("Erreur création bordereau :", err);
    res.status(500).json({ success: false, message: "Erreur lors de la création du bordereau" });
  }
};

/* ---------------- ENREGISTRER UNE TRANSMISSION ---------------- */
exports.transmettreBordereau = async (req, res) => {
  try {
    const { courrier_id, bordereau_id, destinataire_id, expediteur_id } = req.body;

    if (!courrier_id || !bordereau_id || !destinataire_id || !expediteur_id) {
      return res.status(400).json({ message: "⚠️ Tous les champs sont obligatoires" });
    }

    const result = await db.query(
      `INSERT INTO envois (courrier_id, bordereau_id, destinataire_id, expediteur_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [courrier_id || null, bordereau_id, destinataire_id, expediteur_id]
    );

    await db.query(
      `UPDATE bordereaux SET statut = 'envoye' WHERE id = $1`,
      [bordereau_id]
    );

    res.status(201).json({
      success: true,
      message: "Transmission réussie ✅",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("Erreur transmission :", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

/* ---------------- DELETE ------------------------------------- */
exports.remove = async (req, res) => {
  try {
    await Bordereau.remove(req.params.id);
    res.json({ success: true, message: 'Supprimé' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erreur lors de la suppression' });
  }
};
