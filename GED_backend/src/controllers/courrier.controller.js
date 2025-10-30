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

    // 🕒 Générer automatiquement l’heure actuelle (serveur)
    const maintenant = new Date();
    const heure = `${String(maintenant.getHours()).padStart(2, "0")}:${String(maintenant.getMinutes()).padStart(2, "0")}`;

    // 🗂️ Upload de tous les fichiers vers Backblaze B2
    const fichiersUploads = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const fileUrl = await uploadToB2(
          file.path,
          file.originalname,
          file.mimetype
        );
        fichiersUploads.push(fileUrl);
        fs.unlink(file.path, () => {}); // suppression du fichier temporaire local
      }
    }

    // 🧾 Création du courrier en DB
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

    res.status(201).json({
      success: true,
      message: "Courrier créé avec plusieurs fichiers",
      data: courrier
    });

  } catch (err) {
    console.error("❌ Erreur création courrier :", err);
    res.status(500).json({
      success: false,
      message: "Erreur interne lors de la création du courrier"
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
    const courrier = await Courrier.findById(req.params.id);
    if (!courrier || !courrier.fichier_scan) {
      return res.status(404).json({ success: false, message: "Fichier introuvable" });
    }

    // 🔹 Gestion du champ JSON.stringify(fichiersUploads)
    let fichiers = [];
    if (courrier.fichier_scan) {
      try {
        fichiers = JSON.parse(courrier.fichier_scan);
      } catch {
        fichiers = [courrier.fichier_scan];
      }
    }

    if (!fichiers.length) {
      return res.status(404).json({ success: false, message: "Aucun fichier à télécharger" });
    }

    // 🔹 On prend le premier fichier (tu peux boucler si tu veux tous les compresser ensuite)
    let key = fichiers[0];

    // Si c’est une URL complète, extraire la clé S3
    if (/^https?:\/\//i.test(key)) {
      const urlObj = new URL(key);
      key = urlObj.pathname.split(`${process.env.B2_BUCKET_NAME}/`).pop();
      key = decodeURIComponent(key);
    }

    console.log("✅ Clé pour getObject :", key);

    const params = { Bucket: process.env.B2_BUCKET_NAME, Key: key };
    const data = await s3.getObject(params).promise();

    // Nom du fichier et type MIME correct
    const fileName = path.basename(key);
    const contentType = data.ContentType || mime.lookup(fileName) || "application/octet-stream";

    console.log("Nom du fichier :", fileName);
    console.log("Content-Type :", contentType);
    console.log("Taille du fichier :", data.ContentLength);

    // Headers HTTP
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Length", data.ContentLength || data.Body.length);

    // Envoi du fichier
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
const secureDownload = async (req, res) => {
  try {
    const courrierId = req.params.courrierId;
    const index = parseInt(req.query.index) || 0; // 🔹 index du fichier à télécharger
    const courrier = await Courrier.findById(courrierId);

    if (!courrier || !courrier.fichier_scan) {
      return res.status(404).json({ success: false, message: "Fichier introuvable" });
    }

    let fichiers = [];
    try {
      fichiers = JSON.parse(courrier.fichier_scan);
    } catch {
      fichiers = [courrier.fichier_scan];
    }

    if (!fichiers.length || index >= fichiers.length) {
      return res.status(404).json({ success: false, message: "Fichier introuvable" });
    }

    const fileUrl = fichiers[index];
    const fileName = decodeURIComponent(require("path").basename(fileUrl));

    console.log("📦 Téléchargement sécurisé depuis :", fileUrl);

    const response = await require('axios').get(fileUrl, { responseType: "stream" });

    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Type", response.headers["content-type"] || "application/octet-stream");

    response.data.pipe(res);

  } catch (err) {
    console.error("❌ Erreur téléchargement sécurisé :", err.message);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Erreur téléchargement",
        error: err.message,
      });
    }
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
  secureDownload
};
