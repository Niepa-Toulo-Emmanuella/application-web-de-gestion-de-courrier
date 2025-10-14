// src/routes/imputation.routes.js
const express = require('express');
const router = express.Router();
const imputationController = require('../controllers/imputation.controller');
const { authenticate } = require('../middlewares/auth.middleware');

// Assurez-vous d'avoir dans votre .env :
// B2_BUCKET_NAME, B2_ENDPOINT (optionnel si S3 API), B2_KEY_ID, B2_APP_KEY

// Fonction générique pour générer l'URL publique
function getB2Url(key) {
  if (!key) return null;
  // Ici on suppose que ton bucket est public
  return `https://${process.env.B2_BUCKET_NAME}.s3.us-east-005.backblazeb2.com/${key}`;
}

// POST /api/imputations
router.post('/', authenticate, imputationController.create);

// Transmettre un bordereau d’imputation
router.post("/transmettre", authenticate, imputationController.createTransmission);

router.get('/', authenticate, imputationController.getAll); // liste des imputations
// Récupérer toutes les transmissions pour une imputation
router.get("/:id/transmissions", authenticate, imputationController.getTransmissions);

router.get("/transmissions/:userId", authenticate, imputationController.getTransmissionsForUser);

// 3️⃣ Téléchargement imputation
router.get('/imputations/download/:filename', (req, res) => {
  const key = decodeURIComponent(req.params.filename);
  const url = getB2Url(key);
  if (!url) return res.status(404).send("Fichier introuvable");
  res.redirect(url);
});

// 1️⃣ Téléchargement courrier
router.get('/courriers/download/:filename', (req, res) => {
  const key = decodeURIComponent(req.params.filename);
  const url = getB2Url(key);
  if (!url) return res.status(404).send("Fichier introuvable");
  res.redirect(url); // redirection vers B2
});

// 2️⃣ Téléchargement bordereau
router.get('/bordereaux/download/:filename', (req, res) => {
  const key = decodeURIComponent(req.params.filename);
  const url = getB2Url(key);
  if (!url) return res.status(404).send("Fichier introuvable");
  res.redirect(url);
});




module.exports = router;
