const express = require('express');
const router = express.Router();
const archiveController = require('../controllers/archive.controller');
const { verifyToken, isAdminOrAgent } = require('../middlewares/auth.middleware');

// 🧠 1️⃣ Lancer un archivage pour une année donnée (asynchrone)
router.post('/archive/:year', verifyToken, isAdminOrAgent, archiveController.launchArchive);

// 📊 2️⃣ Vérifier le statut d’un archivage
router.get('/archive/status/:year', archiveController.getArchiveStatus);

// 📦 3️⃣ Télécharger l’archive ZIP d’une année donnée
router.get('/archive/download/:year', verifyToken, isAdminOrAgent, archiveController.downloadArchive);

module.exports = router;
