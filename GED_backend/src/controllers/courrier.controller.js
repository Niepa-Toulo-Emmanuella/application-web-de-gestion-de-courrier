// courrier.controller.js
require('dotenv').config(); // <--- AJOUTE CECI TOUT EN HAUT
const fs = require('fs');
const Courrier = require('../models/Courrier');
const { uploadToB2 } = require('../helpers/b2upload');
const AWS = require('aws-sdk');
const axios = require('axios');
const path = require("path");
const mime = require('mime-types'); // ajouter en haut
const jwt = require("jsonwebtoken");
const db = require('../models/db'); // <-- si ton fichier db.js exporte la connexion PostgreSQL
const FormData = require("form-data");

const s3 = new AWS.S3({
  endpoint: process.env.B2_ENDPOINT,
  accessKeyId: process.env.B2_KEY_ID,
  secretAccessKey: process.env.B2_APP_KEY,
  region: process.env.B2_REGION,
  s3ForcePathStyle: true, // important pour Backblaze
});

// -------------------- Fonction pour générer le numéro d'enregistrement -------------------- //
/**
 * Retourne : { numero: string, annee: number }
 * - commence à 4975 si la table est vide,
 * - incrémente tant que la dernière création est dans la même année,
 * - si la dernière création appartient à une année antérieure => reset à 1
 */
async function genererNumeroEnregistrement() {
  const maintenant = new Date();
  const anneeActuelle = maintenant.getFullYear();

  // 🔍 Récupérer le dernier courrier enregistré
  const result = await db.query(
    'SELECT numero_enregistrement, annee_generation, created_at FROM courriers ORDER BY created_at DESC LIMIT 1'
  );
  const dernierCourrier = result.rows[0];

  // Valeur de départ
  let numeroBigInt = 4975n;

  if (!dernierCourrier) {
    return { numero: numeroBigInt.toString(), annee: anneeActuelle };
  }

  const derniereAnnee = dernierCourrier.annee_generation
    ? Number(dernierCourrier.annee_generation)
    : new Date(dernierCourrier.created_at).getFullYear();

  if (anneeActuelle > derniereAnnee) {
    // 🆕 Nouvelle année → on recommence à 1
    return { numero: '1', annee: anneeActuelle };
  }

  // Même année → on incrémente
  const dernierNumeroRaw = dernierCourrier.numero_enregistrement ?? '4974';
  let dernierNumeroBigInt;
  try {
    dernierNumeroBigInt = BigInt(dernierNumeroRaw);
  } catch {
    dernierNumeroBigInt = 4974n;
  }

  numeroBigInt = dernierNumeroBigInt + 1n;
  return { numero: numeroBigInt.toString(), annee: anneeActuelle };
}



/* ------------------------------ POST ------------------------------ */
const create = async (req, res) => {
  try {
    console.log('✅ Données reçues :', req.body);
    console.log('📂 Fichiers reçus :', req.files?.length || 0);

    const { reference, objet, expediteur, destinataire, date_reception, date_arrivee, priorite } = req.body;

    // Si priorite n'est pas fournie, mettre par défaut 'Normale'
    const prioriteFinale = priorite || 'Normale';
    
    // 🔢 Génération du numéro d’enregistrement
    const { numero, annee } = await genererNumeroEnregistrement();

    const maintenant = new Date();
    const heure = `${String(maintenant.getHours()).padStart(2, '0')}:${String(
      maintenant.getMinutes()
    ).padStart(2, '0')}`;

    // 🗂️ Upload vers Backblaze
    const fichiersUploads = [];

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        let safeName = Buffer.from(file.originalname, 'latin1').toString('utf8').normalize('NFC');
        const fileUrl = await uploadToB2(file.path, safeName, file.mimetype);
        fichiersUploads.push(fileUrl);
        fs.unlink(file.path, () => {});
      }
    }

    // 🧾 Création du courrier dans la DB
    console.log("🗃️ Données finales avant insertion DB :", {
      reference,
      objet,
      expediteur,
      destinataire,
      fichiersUploads,
      numero,
      annee,
      priorite
    });

    // 🧾 Insertion du courrier
    const courrier = await Courrier.create({
      reference,
      objet,
      expediteur,
      destinataire,
      date_reception,
      date_arrivee,
      numero_enregistrement: numero,
      annee_generation: annee,
      heure,
      fichier_scan: JSON.stringify(fichiersUploads),
      priorite: prioriteFinale,
    });

    console.log('📦 Courrier inséré avec numéro :', numero);
    res.status(201).json({
      success: true,
      message: 'Courrier créé avec succès',
      data: courrier,
    });
  } catch (err) {
    console.error('❌ Erreur création courrier :', err);
    res.status(500).json({
      success: false,
      message: 'Erreur interne lors de la création du courrier',
      error: err.message,
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

// ----------------------------- TÉLÉCHARGEMENT ----------------------------- //
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
      fichiers = Array.isArray(courrier.fichier_scan) ? courrier.fichier_scan : JSON.parse(courrier.fichier_scan);
    } catch (err) {
      console.warn("⚠️ fichier_scan n'est pas un JSON valide, on le met dans un tableau :", err.message);
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
    const s3data = await s3.getObject(params).promise();

    const fileName = path.basename(key);
    const contentType = s3data.ContentType || mime.lookup(fileName) || "application/octet-stream";

    console.log("Nom du fichier :", fileName);
    console.log("Content-Type :", contentType);
    console.log("Taille du fichier :", s3data.ContentLength);

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Length", s3data.ContentLength || s3data.Body.length);

    return res.send(s3data.Body);

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

// ----------------------------- DOWNLOAD SÉCURISÉ ----------------------------- //
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
    try {
      fichiers = Array.isArray(courrier.fichier_scan) ? courrier.fichier_scan : JSON.parse(courrier.fichier_scan);
    } catch (err) {
      console.error("❌ Erreur parsing fichier_scan :", err);
      return res.status(500).json({ success: false, message: "Format fichier invalide" });
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

// ----------------------------- PREVIEW SÉCURISÉ ----------------------------- //
const securePreview = async (req, res) => {
  try {
    const courrierId = req.params.id;
    const index = parseInt(req.query.index || 0);

    console.log(`[DEBUG] securePreview appelé, courrierId=${courrierId}, index=${index}`);

    // 🔹 Récupération du courrier
    const courrier = await Courrier.findById(courrierId);
    if (!courrier || !courrier.fichier_scan) {
      return res.status(404).json({ success: false, message: "Fichier introuvable" });
    }

    // 🔹 Liste des fichiers
    let fichiers = [];
    try {
      fichiers = Array.isArray(courrier.fichier_scan) ? courrier.fichier_scan : JSON.parse(courrier.fichier_scan);
    } catch (err) {
      return res.status(500).json({ success: false, message: "Format fichier invalide" });
    }

    if (index < 0 || index >= fichiers.length) {
      return res.status(404).json({ success: false, message: "Index de fichier invalide" });
    }

    const fileUrl = fichiers[index];
    const ext = path.extname(fileUrl).toLowerCase();
    const officeTypes = [".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"];

    // 🔹 Téléchargement depuis B2
    const key = decodeURIComponent(new URL(fileUrl).pathname.split(`${process.env.B2_BUCKET_NAME}/`).pop());
    const s3Data = await s3.getObject({ Bucket: process.env.B2_BUCKET_NAME, Key: key }).promise();
    const fileBuffer = s3Data.Body;

    // ============================================================
    // 🧩 CAS 1 : Fichier Office → Conversion en PDF via CloudConvert
    // ============================================================
    if (officeTypes.includes(ext)) {
      console.log("🔑 Envoi à CloudConvert...");
      console.log("CloudConvert Key:", process.env.CLOUDCONVERT_API_KEY ? "✅ chargée" : "❌ manquante");

      // ⚙️ Étape 1 : créer un job CloudConvert
      const jobResponse = await axios.post(
        "https://api.cloudconvert.com/v2/jobs",
        {
          tasks: {
            "import-my-file": {
              operation: "import/upload",
            },
            "convert-my-file": {
              operation: "convert",
              input: "import-my-file",
              output_format: "pdf",
            },
            "export-my-file": {
              operation: "export/url",
              input: "convert-my-file",
            },
          },
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.CLOUDCONVERT_API_KEY}`,
          },
        }
      );

      const uploadUrl = jobResponse.data.data.tasks.find(t => t.name === "import-my-file").result.form.url;
      const uploadParams = jobResponse.data.data.tasks.find(t => t.name === "import-my-file").result.form.parameters;

      // ⚙️ Étape 2 : uploader le fichier vers CloudConvert
      const uploadForm = new FormData();
      for (const [k, v] of Object.entries(uploadParams)) {
        uploadForm.append(k, v);
      }
      uploadForm.append("file", fileBuffer, path.basename(fileUrl));

      await axios.post(uploadUrl, uploadForm, { headers: uploadForm.getHeaders() });

      // ⚙️ Étape 3 : attendre la fin de la conversion
      let exportUrl = null;
      for (let i = 0; i < 20; i++) {
        const statusRes = await axios.get(`https://api.cloudconvert.com/v2/jobs/${jobResponse.data.data.id}`, {
          headers: { Authorization: `Bearer ${process.env.CLOUDCONVERT_API_KEY}` },
        });

        const exportTask = statusRes.data.data.tasks.find(
          t => t.name === "export-my-file" && t.status === "finished"
        );

        if (exportTask && exportTask.result && exportTask.result.files && exportTask.result.files[0]) {
          exportUrl = exportTask.result.files[0].url;
          break;
        }
        await new Promise(r => setTimeout(r, 2000)); // attendre 2 secondes
      }

      if (!exportUrl) throw new Error("Conversion CloudConvert non terminée");

      // ⚙️ Étape 4 : télécharger le PDF final
      const pdfRes = await axios.get(exportUrl, { responseType: "arraybuffer" });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${path.basename(fileUrl, ext)}.pdf"`);
      return res.send(pdfRes.data);
    }

    // ============================================================
    // 🧩 CAS 2 : PDF ou image → affichage direct
    // ============================================================
    const contentType = s3Data.ContentType || mime.lookup(key) || "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `inline; filename="${path.basename(key)}"`);
    res.send(fileBuffer);

  } catch (err) {
    console.error("❌ Erreur aperçu sécurisé :", err.message || err);
    if (err.response?.data) {
      console.error("↳ CloudConvert Response:", err.response.data);
    }
    res.status(500).json({ success: false, message: "Erreur lors de l’aperçu" });
  }
};

// ===================== COURRIERS SANS BORDEREAU =====================

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
        c.fichier_scan,
        c.priorite
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
