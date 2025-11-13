const express = require('express');
const router = express.Router();
const archiveController = require('../controllers/archive.controller');
const { verifyToken, isAdminOrAgent } = require('../middlewares/auth.middleware');

// 🟢 Lancer l'archivage pour une année donnée
router.post(
  '/launch/:year',
  verifyToken,
  isAdminOrAgent, // 🔒 Seuls les agents peuvent lancer
  archiveController.launchArchive
);

// 🟡 Vérifier le statut d’un archivage (accessible à tout utilisateur connecté)
router.get(
  '/status/:year',
  verifyToken, // 🔒 Nécessite juste un token valide
  archiveController.getArchiveStatus
);

// 🟢 Télécharger une archive
router.get(
  '/download/:year',
  verifyToken,
  isAdminOrAgent, // 🔒 Seuls les agents peuvent télécharger
  archiveController.downloadArchive
);

// 🟢 Générer une URL signée pour téléchargement sécurisé
router.get(
  '/signed-url/:year',
  verifyToken,
  isAdminOrAgent, // 🔒 Seuls les agents peuvent obtenir l’URL
  archiveController.getSignedUrl
);

module.exports = router;
