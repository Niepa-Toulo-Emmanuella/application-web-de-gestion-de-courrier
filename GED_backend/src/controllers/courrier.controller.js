// courrier.controller.js
require('dotenv').config(); // <--- AJOUTE CECI TOUT EN HAUT
const fs = require('fs');
const Courrier = require('../models/Courrier');
const uploadToB2 = require('../helpers/b2upload'); // version S3-compatible
const AWS = require('aws-sdk');
const axios = require('axios');
const path = require("path");
const mime = require('mime-types'); // ajouter en haut
const jwt = require("jsonwebtoken");
const db = require('../models/db'); // <-- si ton fichier db.js exporte la connexion PostgreSQL






const s3 = new AWS.S3({
  endpoint: process.env.B2_ENDPOINT,
  accessKeyId: process.env.B2_KEY_ID,
  secretAccessKey: process.env.B2_APP_KEY,
  region: process.env.B2_REGION,
  s3ForcePathStyle: true, // important pour Backblaze
});

// -------------------- Fonction pour générer le numéro d'enregistrement -------------------- //
async function genererNumeroEnregistrement() {
  const prefix = "MJ"; // ✏️ Ton code service
  const maintenant = new Date();

  const annee = maintenant.getFullYear();
  const mois = String(maintenant.getMonth() + 1).padStart(2, "0"); // 01 à 12
  const jour = String(maintenant.getDate()).padStart(2, "0"); // 01 à 31

  // 🕵️ Chercher le dernier courrier créé aujourd’hui
  const result = await Courrier.findLastByDate(annee, mois, jour);

  // Si aucun courrier aujourd'hui, on commence à 1
  let numero = 1;
  if (result) {
    const parts = result.numero_enregistrement.split("-");
    numero = parseInt(parts[4]) + 1; // La 5e partie contient le numéro du jour
  }

  const numeroFormatte = numero.toString().padStart(3, "0");

  return `${prefix}-${annee}-${mois}-${jour}-${numeroFormatte}`;
}


/* ------------------------------ POST ------------------------------ */
const create = async (req, res) => {
  try {
    console.log("✅ Données reçues :", req.body);
    console.log("📂 Fichiers reçus :", req.files?.length || 0);

    const {
      reference,
      objet,
      expediteur,
      destinataire,
      date_reception,
      date_arrivee
    } = req.body;

    // 🧩 Générer le numéro d’enregistrement
    const numero_enregistrement = await genererNumeroEnregistrement();

    // 🕒 Heure actuelle (serveur)
    const maintenant = new Date();
    const heure = `${String(maintenant.getHours()).padStart(2, "0")}:${String(maintenant.getMinutes()).padStart(2, "0")}`;

    // 🗂️ Upload de tous les fichiers vers Backblaze B2
    const fichiersUploads = [];

    if (req.files && req.files.length > 0) {
      console.log("🔍 Détails des fichiers avant upload :");
      req.files.forEach((file, i) => {
        console.log(`   → Fichier [${i}]: originalname="${file.originalname}", path="${file.path}", mimetype="${file.mimetype}"`);
      });

      // ✅ Boucle principale avec correction d'encodage
      for (const file of req.files) {
        console.log("🧩 Nom original reçu :", file.originalname);

        // 🧠 Corriger le nom (reconvertir depuis Latin1 → UTF8)
        let safeName = Buffer.from(file.originalname, "latin1").toString("utf8");
        safeName = safeName.normalize("NFC"); // ✅ normalisation UTF-8
        console.log("✅ Nom corrigé UTF-8 :", safeName);

        // 🆙 Upload vers Backblaze
        const fileUrl = await uploadToB2(
          file.path,
          safeName,
          file.mimetype
        );

        console.log("🌐 URL renvoyée par B2 :", fileUrl);

        // ✅ Vérifier si le nom dans l’URL est propre
        if (/Ã|Â|�/.test(fileUrl)) {
          console.warn("⚠️ URL retournée mal encodée :", fileUrl);
        } else {
          console.log("✅ URL propre :", fileUrl);
        }

        fichiersUploads.push(fileUrl);
        fs.unlink(file.path, () => {}); // suppression du fichier temporaire
      }
    } else {
      console.warn("⚠️ Aucun fichier à uploader !");
    }

    // 🧾 Création du courrier dans la DB
    console.log("🗃️ Données finales avant insertion DB :", {
      reference,
      objet,
      expediteur,
      destinataire,
      fichiersUploads
    });

    const courrier = await Courrier.create({
      reference,
      objet,
      expediteur,
      destinataire,
      date_reception,
      date_arrivee,
      numero_enregistrement,
      heure,
      fichier_scan: JSON.stringify(fichiersUploads), // ✅ tableau de liens
    });

    console.log("📦 Courrier inséré avec fichier_scan :", courrier.fichier_scan);

    res.status(201).json({
      success: true,
      message: "Courrier créé avec plusieurs fichiers",
      data: courrier
    });

  } catch (err) {
    console.error("❌ Erreur création courrier :", err);
    res.status(500).json({
      success: false,
      message: "Erreur interne lors de la création du courrier",
      error: err.message
    });
  }
};


/* ------------------------------ LIST ------------------------------ */
const list = async (_req, res) => {
  try {
    const courriers = await Courrier.findAll();
    res.json({ success: true, data: courriers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erreur liste courriers' });
  }
};

/* ----------------------------- DETAIL ----------------------------- */
const detail = async (req, res) => {
  try {
    const courrier = await Courrier.findById(req.params.id);
    if (!courrier) {
      return res.status(404).json({ success: false, message: 'Courrier introuvable' });
    }
    res.json({ success: true, data: courrier });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erreur détail courrier' });
  }
};

/* ----------------------------- REMOVE ----------------------------- */
const remove = async (req, res) => {
  try {
    const role = req.user.role; // Assure-toi que req.user est rempli par l'auth middleware
    if (role !== 'admin' && role !== 'agent') {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }

    await Courrier.remove(req.params.id);
    res.json({ success: true, message: 'Courrier supprimé' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erreur suppression courrier' });
  }
};

/* ------------------------------ UPDATE ---------------------------- */
const update = async (req, res) => {
  try {
    let fileUrl = null;
    if (req.file) {
      fileUrl = await uploadToB2(
        req.file.path,
        req.file.originalname,
        req.file.mimetype
      );
      fs.unlink(req.file.path, () => {});
    }

    const data = { ...req.body };
    if (fileUrl) data.fichier_scan = fileUrl;

    const courrier = await Courrier.update(req.params.id, data);
    res.json({ success: true, data: courrier });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erreur mise à jour courrier' });
  }
};

// Téléchargement via URL signée
// Téléchargement direct du fichier depuis Backblaze B2
// ----------------------------- TÉLÉCHARGEMENT ----------------------------- //
// place ceci dans ton fichier de contrôleur (assure-toi des require en haut : path, AWS, Courrier, etc.)
const download = async (req, res) => {
  try {
    console.log("📌 download appelé avec params :", req.params);
    const courrier = await Courrier.findById(req.params.id);
    console.log("📄 Courrier récupéré :", courrier);

    if (!courrier) {
      console.error("❌ Courrier introuvable pour l'ID :", req.params.id);
      return res.status(404).json({ success: false, message: "Fichier introuvable" });
    }

    if (!courrier.fichier_scan) {
      console.error("❌ Aucun fichier attaché pour le courrier ID :", req.params.id);
      return res.status(404).json({ success: false, message: "Aucun fichier à télécharger" });
    }

    // 🔹 Gestion du champ JSON.stringify(fichiersUploads)
    let fichiers = [];
    try {
      fichiers = JSON.parse(courrier.fichier_scan);
    } catch (err) {
      console.warn("⚠️ fichier_scan n'est pas un JSON, on le met dans un tableau :", err.message);
      fichiers = [courrier.fichier_scan];
    }

    if (!fichiers.length) {
      console.error("❌ Aucun fichier trouvé après parsing pour le courrier ID :", req.params.id);
      return res.status(404).json({ success: false, message: "Aucun fichier à télécharger" });
    }

    // 🔹 On prend le premier fichier
    let key = fichiers[0];

    if (/^https?:\/\//i.test(key)) {
      const urlObj = new URL(key);
      key = urlObj.pathname.split(`${process.env.B2_BUCKET_NAME}/`).pop();
      key = decodeURIComponent(key);
    }

    console.log("✅ Clé pour getObject :", key);

    const params = { Bucket: process.env.B2_BUCKET_NAME, Key: key };
    const data = await s3.getObject(params).promise();

    const fileName = path.basename(key);
    const contentType = data.ContentType || mime.lookup(fileName) || "application/octet-stream";

    console.log("Nom du fichier :", fileName);
    console.log("Content-Type :", contentType);
    console.log("Taille du fichier :", data.ContentLength);

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Length", data.ContentLength || data.Body.length);

    return res.send(data.Body);

  } catch (err) {
    console.error("❌ Erreur téléchargement :", err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Erreur téléchargement",
        error: err.message,
      });
    }
  }
};


const detailForDownload = async (id) => {
  const courrier = await Courrier.findById(id);
  return courrier;
};


// ----------------------------- TÉLÉCHARGEMENT SÉCURISÉ ----------------------------- //
// Télécharger un courrier depuis Backblaze B2 via fetch() sécurisé
// ----------------------------- TÉLÉCHARGEMENT SÉCURISÉ -----------------------------
// ✅ Fonction sécurisée de téléchargement Backblaze B2
/* ------------------------------ DOWNLOAD SÉCURISÉ ------------------------------ */
const secureDownload = async (req, res) => {
  try {
    const courrierId = req.params.id;
    const index = parseInt(req.query.index || 0);

    console.log("🔐 Téléchargement sécurisé du courrier ID :", courrierId, "index :", index);

    // ✅ Récupération du courrier depuis la DB
    console.log("📬 Recherche du courrier ID :", courrierId);
    const courrier = await Courrier.findById(courrierId);
    console.log("Résultat trouvé :", courrier);

    if (!courrier) {
      console.warn("⚠️ Courrier introuvable pour l’ID :", courrierId);
      return res.status(404).json({ success: false, message: "Courrier introuvable" });
    }

    if (!courrier.fichier_scan) {
      console.warn("⚠️ Aucun fichier enregistré pour ce courrier");
      return res.status(404).json({ success: false, message: "Aucun fichier à télécharger" });
    }

    // ✅ Convertir la colonne en tableau si elle est en JSON ou déjà un tableau
    let fichiers = [];
    if (Array.isArray(courrier.fichier_scan)) {
      fichiers = courrier.fichier_scan;
    } else {
      try {
        fichiers = JSON.parse(courrier.fichier_scan);
      } catch (err) {
        console.error("❌ Erreur parsing fichier_scan :", err);
        return res.status(500).json({ success: false, message: "Format fichier invalide" });
      }
    }

    // ✅ Vérifier si l’index demandé existe
    if (index < 0 || index >= fichiers.length) {
      console.warn("⚠️ Index de fichier invalide :", index);
      return res.status(404).json({ success: false, message: "Fichier introuvable" });
    }

    const fileUrl = fichiers[index];
    console.log("🌐 URL du fichier à télécharger :", fileUrl);

    // ✅ Télécharger depuis Backblaze B2
    const response = await fetch(fileUrl);

    if (!response.ok) {
      console.error("❌ Erreur lors du téléchargement depuis B2 :", response.statusText);
      return res.status(404).json({ success: false, message: "Fichier introuvable sur B2" });
    }

    // ✅ Lire le corps en Buffer (compatible Node 18+)
    const buffer = Buffer.from(await response.arrayBuffer());

    // ✅ Extraire le nom du fichier
    const parts = fileUrl.split("/");
    const fileName = decodeURIComponent(parts[parts.length - 1]);

    // ✅ Définir les bons headers HTTP
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Type", response.headers.get("content-type") || "application/octet-stream");

    // ✅ Envoyer le fichier au client
    res.send(buffer);

    console.log("✅ Téléchargement réussi :", fileName);

  } catch (err) {
    console.error("❌ Erreur téléchargement sécurisé :", err);
    res.status(500).json({
      success: false,
      message: "Erreur téléchargement",
      error: err.message
    });
  }
};

// ✅ Version "prévisualisation"
const axios = require("axios");
const FormData = require("form-data");

const securePreview = async (req, res) => {
  try {
    const courrierId = req.params.id;
    const index = parseInt(req.query.index || 0);

    const courrier = await Courrier.findById(courrierId);
    if (!courrier || !courrier.fichier_scan) {
      return res.status(404).json({ success: false, message: "Fichier introuvable" });
    }

    let fichiers = Array.isArray(courrier.fichier_scan)
      ? courrier.fichier_scan
      : JSON.parse(courrier.fichier_scan);

    if (index < 0 || index >= fichiers.length) {
      return res.status(404).json({ success: false, message: "Index de fichier invalide" });
    }

    const fileUrl = fichiers[index];
    const ext = path.extname(fileUrl).toLowerCase();
    const officeTypes = [".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"];

    // Récupérer le fichier depuis S3
    const key = decodeURIComponent(new URL(fileUrl).pathname.split(`${process.env.B2_BUCKET_NAME}/`).pop());
    const s3Data = await s3.getObject({ Bucket: process.env.B2_BUCKET_NAME, Key: key }).promise();
    const fileBuffer = s3Data.Body;

    if (officeTypes.includes(ext)) {
      // ⚡ Conversion via CloudConvert API
      const formData = new FormData();
      formData.append("file", fileBuffer, path.basename(fileUrl));
      formData.append("inputformat", ext.replace(".", ""));
      formData.append("outputformat", "pdf");

      const cloudRes = await axios.post(
        "https://api.cloudconvert.com/v2/convert",
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            Authorization: `Bearer ${process.env.CLOUDCONVERT_API_KEY}`,
          },
          responseType: "arraybuffer"
        }
      );

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${path.basename(fileUrl, ext)}.pdf"`);
      return res.send(cloudRes.data);
    }

    // 🔹 PDF ou autre → affichage direct
    const contentType = s3Data.ContentType || mime.lookup(key) || "application/octet-stream";

    if (contentType.includes("pdf")) {
      res.setHeader("Content-Disposition", `inline; filename="${path.basename(key)}"`);
    } else {
      res.setHeader("Content-Disposition", `attachment; filename="${path.basename(key)}"`);
    }

    res.setHeader("Content-Type", contentType);
    res.send(fileBuffer);

  } catch (err) {
    console.error("❌ Erreur aperçu sécurisé :", err);
    res.status(500).json({ success: false, message: "Erreur lors de l’aperçu" });
  }
};





// ===================== COURRIERS SANS BORDEREAU =====================

// const getCourriersDisponibles = async (req, res) => {
//   try {
//     const result = await db.query(`
//       SELECT c.id, c.reference, c.objet
//       FROM courriers c
//       LEFT JOIN bordereaux b ON b.courrier_id = c.id
//       WHERE b.courrier_id IS NULL
//       ORDER BY c.created_at DESC;

//     `);
//     console.log("Courriers disponibles :", result.rows); // <-- ADD THIS

//     res.json({ success: true, data: result.rows }); // <-- ajouter success + data
//   } catch (err) {
//     console.error("❌ Erreur getCourriersDisponibles :", err);
//     res.status(500).json({ message: "Erreur lors de la récupération des courriers disponibles" });
//   }
// };

const getCourriersDisponibles = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        c.id,
        c.reference,
        c.objet,
        c.expediteur,
        c.date_reception,
        c.date_arrivee,
        c.numero_enregistrement,
        c.heure,
        c.fichier_scan
      FROM courriers c
      LEFT JOIN bordereaux b ON b.courrier_id = c.id
      WHERE b.courrier_id IS NULL
      ORDER BY c.created_at DESC;
    `);

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("❌ Erreur getCourriersDisponibles :", err);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des courriers disponibles",
    });
  }
};









module.exports = {
  create,
  list,
  detail,
  remove,
  update,
  download,
  detailForDownload,
  secureDownload,
  getCourriersDisponibles,
  securePreview
};
