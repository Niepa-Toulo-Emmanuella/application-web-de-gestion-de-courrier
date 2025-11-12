// bordereau.controller.js
const db = require('../models/db');
const Bordereau = require('../models/Bordereau');
const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const pool = require("../models/db");

// -------- Client S3 Backblaze B2 --------
const s3 = new AWS.S3({
  endpoint: process.env.B2_ENDPOINT,
  accessKeyId: process.env.B2_KEY_ID,
  secretAccessKey: process.env.B2_APP_KEY,
});

// -------------------- Fonction pour générer le numéro de bordereau -------------------- //
// -------------------- Fonction pour générer le numéro de bordereau -------------------- //
async function genererNumeroBordereau() {
  const maintenant = new Date();
  const anneeActuelle = maintenant.getFullYear();

  // 🔍 Récupérer le dernier bordereau enregistré
  const result = await db.query(
    'SELECT numero, created_at FROM bordereaux ORDER BY created_at DESC LIMIT 1'
  );
  const dernier = result.rows[0];

  // Valeur de départ
  let numeroBigInt = 4975n;

  if (!dernier) {
    return { numero: `BDR-${numeroBigInt.toString()}`, annee: anneeActuelle };
  }

  // On prend l'année du dernier bordereau pour vérifier si elle est différente
  const derniereAnnee = new Date(dernier.created_at).getFullYear();

  if (anneeActuelle > derniereAnnee) {
    // Nouvelle année → reset à 1
    return { numero: `BDR-1`, annee: anneeActuelle };
  }

  // Même année → on incrémente
  const dernierNumeroRaw = dernier.numero?.replace(/^BDR-/, '') ?? '4974';
  let dernierNumeroBigInt;
  try {
    dernierNumeroBigInt = BigInt(dernierNumeroRaw);
  } catch {
    dernierNumeroBigInt = 4974n;
  }

  numeroBigInt = dernierNumeroBigInt + 1n;
  return { numero: `BDR-${numeroBigInt.toString()}`, annee: anneeActuelle };
}



// -------- Générateur automatique de numéro --------
// function generateNumero() {
//   const date = new Date();
//   return `BDR-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${Date.now()}`;
// }

// -------- Générer le PDF depuis template HTML (Render compatible) --------
async function generateBordereauPDF(data) {
  const templatePath = path.join(__dirname, '../templates/bordereau_template.html');
  let html = fs.readFileSync(templatePath, 'utf-8');

  html = html.replace(/{{NUMERO}}/g, data.numero || '')
             .replace(/{{COURRIER}}/g, data.courrier || '')
             .replace(/{{EXPEDITEUR}}/g, data.expediteur || '')
             .replace(/{{REFERENCE}}/g, data.numero_reference || '')
             .replace(/{{DATE_COURRIER}}/g, data.date_courrier || '')
             .replace(/{{DATE_ARRIVEE}}/g, data.date_arrivee || '')
             .replace(/{{NUMERO_ENREGISTREMENT}}/g, data.numero_enregistrement || '')
             .replace(/{{HEURE}}/g, data.heure || '')
             .replace(/{{OBJET}}/g, data.objet || '')
             .replace(/{{PRIORITE}}/g, data.priorite || 'Non précisée');

  let fichiersHTML = '';

  if (Array.isArray(data.fichier_scan)) {
    // 🔹 Aplatis le tableau s'il contient des sous-tableaux
    const fichiers = data.fichier_scan.flat();

    fichiersHTML = fichiers.map(f => {
      if (typeof f === 'string') {
        const fileName = f.split('/').pop(); // extrait juste le nom du fichier
        return `<div>📎 ${fileName}</div>`;
      } else {
        console.warn('⚠️ Élément inattendu dans fichier_scan :', f);
        return '';
      }
    }).join('');
    
  } else if (data.fichier_scan) {
    // 🔹 Cas où il n’y a qu’un seul fichier (chaîne simple)
    const fileName = data.fichier_scan.split('/').pop();
    fichiersHTML = `<div>📎 ${fileName}</div>`;
  }

  html = html.replace(/{{FICHIER_SCAN}}/g, fichiersHTML);




  const filePath = `temp_bordereau_${Date.now()}.pdf`;

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

  return filePath;
}

// ---------------- LISTE --------------------------------------
exports.list = async (_req, res) => {
  try {
    const query = `
      SELECT 
        b.id,
        b.courrier_id,
        b.numero_reference,
        b.objet,
        b.date_courrier,
        b.date_arrivee,
        b.heure,
        b.numero_enregistrement,
        b.statut,
        b.priorite,
        c.expediteur,
        c.fichier_scan
      FROM bordereaux b
      LEFT JOIN courriers c ON b.courrier_id = c.id
      ORDER BY
        CASE WHEN b.priorite = 'Urgente' THEN 0 ELSE 1 END,  -- urgents d’abord
        b.id DESC;
    `;
    const { rows } = await db.query(query);

    const bordereaux = rows
      .filter(b => b.courrier_id)
      .map(b => {
        const fichiers = (() => {
          try {
            return b.fichier_scan ? JSON.parse(b.fichier_scan) : [];
          } catch {
            return b.fichier_scan ? [b.fichier_scan] : [];
          }
        })();
        const premierFichier = fichiers[0] || null;

        return {
          ...b,
          fichier_scan: premierFichier,
          courrier_id: b.courrier_id
        };
      });

    res.json({ success: true, data: bordereaux });
  } catch (err) {
    console.error("Erreur chargement bordereaux :", err);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
};

// ---------------- DETAIL -------------------------------------
exports.detail = async (req, res) => {
  try {
    const row = await Bordereau.findById(req.params.id);
    if (!row)
      return res.status(404).json({ success: false, message: 'Introuvable' });

    const fichiers = (() => {
      try {
        return row.fichier_scan ? JSON.parse(row.fichier_scan) : [];
      } catch {
        return row.fichier_scan ? [row.fichier_scan] : [];
      }
    })();

    row.fichier_scan = fichiers[0] || null;

    res.json({ success: true, data: row });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ---------------- CREATE -------------------------------------
// ---------------- CREATE -------------------------------------
exports.create = async (req, res) => {
  try {
    const {
      courrier_id, destinataire_id, numero_reference, date_courrier,
      date_arrivee, heure, objet
    } = req.body;

    if (!courrier_id) {
      return res.status(400).json({ success: false, message: "courrier_id est requis" });
    }

    // Récupération du courrier
    const courrierRes = await db.query(
      `SELECT id, fichier_scan, expediteur, objet, priorite, numero_enregistrement FROM courriers WHERE id = $1`,
      [courrier_id]
    );
    if (courrierRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Courrier introuvable" });
    }

    const courrier = courrierRes.rows[0];
    const priorite = courrier.priorite || "Normale";

    // Génération du numéro de bordereau
    const { numero: numeroBordereau } = await genererNumeroBordereau();

    const numero_enregistrement = courrier.numero_enregistrement;

    const expediteurBordereau = courrier.expediteur;


    // 🧾 Génération du PDF avec toutes les données correctes
    const pdfPath = await generateBordereauPDF({
      numero: numeroBordereau,
      numero_enregistrement,
      courrier: courrier.objet,
      fichier_scan: (() => {
        try {
          return courrier.fichier_scan ? JSON.parse(courrier.fichier_scan) : [];
        } catch {
          return courrier.fichier_scan ? [courrier.fichier_scan] : [];
        }
      })(),
      expediteur: expediteurBordereau, // <-- prend l'expéditeur du courrier
      numero_reference,
      date_courrier,
      date_arrivee,
      heure,
      objet,
      priorite
    });

    // Upload du fichier généré
    const fileContent = fs.readFileSync(pdfPath);
    const s3Params = {
      Bucket: process.env.B2_BUCKET_NAME,
      Key: `bordereaux/${Date.now()}_bordereau.pdf`,
      Body: fileContent,
      ContentType: 'application/pdf',
    };
    await s3.upload(s3Params).promise();
    fs.unlinkSync(pdfPath);

    const fichier_bordereau = s3Params.Key;

    const result = await db.query(`
      INSERT INTO bordereaux (
        courrier_id, expediteur, numero_reference,
        date_courrier, date_arrivee, numero_enregistrement, heure,
        objet, priorite, statut, fichier_bordereau, numero
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10'en_attente', $11, $12)
      RETURNING *;
    `, [
      courrier_id,
      expediteurBordereau,
      numero_reference,
      date_courrier,
      date_arrivee,
      numero_enregistrement,
      heure,
      objet, 
      priorite,
      statut,
      fichier_bordereau,
      numeroBordereau
    ]);


    res.status(201).json({
      success: true,
      message: "Bordereau enregistré et PDF généré avec succès",
      data: {bordereau : result.rows[0]}
    });

  } catch (err) {
    console.error("Erreur création bordereau :", err);
    res.status(500).json({ success: false, message: "Erreur lors de la création du bordereau" });
  }
};




// ---------------- ENVOI --------------------------------------
exports.transmettreBordereau = async (req, res) => {
  try {
    const { courrier_id, bordereau_id, destinataire_id, expediteur_id } = req.body;

    if (!courrier_id || !bordereau_id || !destinataire_id || !expediteur_id) {
      return res.status(400).json({ message: "⚠️ Tous les champs sont obligatoires" });
    }

    // 📨 Récupère la priorité pour la notification (optionnel)
    const { rows } = await db.query(`SELECT priorite FROM bordereaux WHERE id = $1`, [bordereau_id]);
    const priorite = rows.length ? rows[0].priorite : "Normale";

    const result = await db.query(
      `INSERT INTO envois (courrier_id, bordereau_id, destinataire_id, expediteur_id, priorite)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [courrier_id || null, bordereau_id, destinataire_id, expediteur_id, priorite]
    );

    await db.query(
      `UPDATE bordereaux SET statut = 'envoye' WHERE id = $1`,
      [bordereau_id]
    );

    res.status(201).json({
      success: true,
      message: "Transmission réussie ✅${priorite === 'Urgente' ? ' (⚠️ URGENT)' : ''}",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("Erreur transmission :", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// ---------------- DELETE -------------------------------------
exports.remove = async (req, res) => {
  try {
    await Bordereau.remove(req.params.id);
    res.json({ success: true, message: 'Supprimé' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erreur lors de la suppression' });
  }
};

// ---------------- REGISTRE TRANSMISSION ---------------------
exports.registreTransmission = async (req, res) => {
  console.log('📌 registreTransmission appelé');
  console.log('Utilisateur:', req.user);
  try {
    const query = `
      SELECT 
        ti.date_depart,
        b.numero_enregistrement,
        b.numero_reference,
        b.objet,
        b.priorite,
        i.imputations AS destinataire,
        ti.observations,
        c.fichier_scan,
        i.fichier_imputation,
        b.fichier_bordereau
      FROM transmissions_imputation ti
      JOIN imputations i ON ti.imputation_id = i.id
      JOIN bordereaux b ON i.bordereau_id = b.id
      JOIN courriers c ON i.courrier_id = c.id
      ORDER BY 
        CASE WHEN b.priorite = 'Urgente' THEN 0 ELSE 1 END,
        ti.date_depart DESC;
    `;

    const result = await pool.query(query);

    const data = result.rows.map(r => {
      const fichiers = (() => {
        try {
          return r.fichier_scan ? JSON.parse(r.fichier_scan) : [];
        } catch {
          return r.fichier_scan ? [r.fichier_scan] : [];
        }
      })();
      const premierFichier = fichiers[0] || null;

      return {
        ...r,
        fichier_scan: premierFichier,
        fichier_bordereau: r.fichier_bordereau
          ? `https://s3.us-east-005.backblazeb2.com/${process.env.B2_BUCKET_NAME}/${r.fichier_bordereau}`
          : null,
        fichier_imputation: r.fichier_imputation
          ? `https://s3.us-east-005.backblazeb2.com/${process.env.B2_BUCKET_NAME}/${r.fichier_imputation}`
          : null
      };
    });

    res.json({ success: true, data });
  } catch (err) {
    console.error("Erreur registreTransmission :", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ---------------- APERÇU SÉCURISÉ BORDEAU ---------------------
// bordereau.controller.js
exports.securePreview = async (req, res) => {
  try {
    const bordereauId = req.params.id;
    const bordereau = await Bordereau.findById(bordereauId);
    if (!bordereau || !bordereau.fichier_bordereau) {
      return res.status(404).json({ success: false, message: "PDF introuvable" });
    }

    const key = bordereau.fichier_bordereau;
    const s3Data = await s3.getObject({ Bucket: process.env.B2_BUCKET_NAME, Key: key }).promise();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${key.split('/').pop()}"`);
    res.send(s3Data.Body);

  } catch (err) {
    console.error("Erreur securePreview bordereau :", err);
    res.status(500).json({ success: false, message: "Erreur aperçu PDF" });
  }
};

// ------------------------------------------------------------------
// Aperçu sécurisé d’un bordereau à partir de la clé S3 (POST)
// ------------------------------------------------------------------
exports.securePreviewByKey = async (req, res) => {
  try {
    const { key } = req.body;

    if (!key) {
      return res.status(400).json({ success: false, message: "Clé du bordereau manquante." });
    }

    // 🔒 (Optionnel) Vérifie que l’utilisateur est bien connecté / autorisé
    // if (!req.user) return res.status(401).json({ success: false, message: "Non autorisé" });

    // Protection basique
    if (key.includes("..")) {
      return res.status(400).json({ success: false, message: "Chemin de fichier invalide." });
    }

    console.log("✅ Aperçu demandé pour la clé :", key);

    // Lecture du fichier depuis ton bucket B2/S3
    const params = {
      Bucket: process.env.B2_BUCKET_NAME,
      Key: key,
    };

    const s3Data = await s3.getObject(params).promise();

    // Envoi du PDF inline
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${key.split("/").pop()}"`
    );
    return res.send(s3Data.Body);

  } catch (err) {
    console.error("❌ Erreur dans securePreviewByKey :", err);
    return res
      .status(500)
      .json({ success: false, message: "Erreur lors du chargement du bordereau." });
  }
};

