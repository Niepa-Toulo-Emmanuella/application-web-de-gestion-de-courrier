const express = require('express');
const router = express.Router();
const archiveController = require('../controllers/archive.controller');
const { verifyToken, isAdminOrAgent } = require('../middlewares/auth.middleware');

// 🧠 Lancer archivage
router.post('/archives/launch/:year', verifyToken, isAdminOrAgent, archiveController.launchArchive);

// 📊 Statut archivage
router.get('/archives/status/:year', verifyToken, archiveController.getArchiveStatus);

// 📦 Télécharger archive ZIP
router.get('/archives/download/:year', verifyToken, isAdminOrAgent, archiveController.downloadArchive);

// 🔗 Générer lien signé
router.get('/archives/signed-url/:year', verifyToken, isAdminOrAgent, archiveController.getSignedUrl);

module.exports = router;
