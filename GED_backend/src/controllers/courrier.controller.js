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
const secureDownload = async (req, res) => {
  try {
    const { id } = req.params;
    const { index } = req.query;

    console.log("------------------------------------------------------");
    console.log(`🔑 Requête de téléchargement sécurisé pour le courrier ID=${id}, index=${index}`);

    // 🔹 Récupération du courrier depuis la base
    const courrier = await Courrier.findByPk(id);
    if (!courrier) {
      console.error("❌ Courrier introuvable dans la BDD");
      return res.status(404).json({ success: false, message: "Courrier introuvable" });
    }

    console.log("📦 Données courrier récupérées :", courrier.dataValues);

    let fichierScan = courrier.fichier_scan;
    console.log("🧩 Valeur brute fichier_scan depuis la BDD :", fichierScan);

    // 🔹 Conversion en tableau
    if (typeof fichierScan === "string") {
      try {
        const parsed = JSON.parse(fichierScan);
        if (Array.isArray(parsed)) {
          fichierScan = parsed;
          console.log("✅ fichier_scan parsé comme tableau :", fichierScan);
        } else {
          fichierScan = [parsed];
          console.log("✅ fichier_scan parsé comme élément unique :", fichierScan);
        }
      } catch (e) {
        console.warn("⚠️ fichier_scan n'était pas JSON parsable, encapsulé dans un tableau");
        fichierScan = [fichierScan];
      }
    }

    // 🔹 Si ce n’est pas un tableau, on force
    if (!Array.isArray(fichierScan)) {
      fichierScan = [fichierScan];
    }

    // 🔹 Vérifie l’index demandé
    const fileUrl = fichierScan[index];
    console.log("📎 URL du fichier demandé :", fileUrl);

    if (!fileUrl) {
      console.error("❌ Aucun fichier trouvé à cet index");
      return res.status(404).json({ success: false, message: "Fichier introuvable" });
    }

    // 🔹 Extraction du nom du fichier
    const fileName = fileUrl.split("/").pop();
    console.log("📁 Nom du fichier extrait :", fileName);

    // 🔹 Téléchargement du fichier depuis Backblaze
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Échec du téléchargement depuis B2 : ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    console.log("✅ Téléchargement réussi depuis Backblaze B2");

    // 🔹 Envoi du fichier au client
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Type", "application/octet-stream");
    res.send(Buffer.from(buffer));

    console.log("✅ Fichier envoyé avec succès :", fileName);
    console.log("------------------------------------------------------");
  } catch (error) {
    console.error("❌ Erreur téléchargement sécurisé :", error);
    res.status(500).json({
      success: false,
      message: "Erreur téléchargement",
      error: error.message,
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
  secureDownload
};
