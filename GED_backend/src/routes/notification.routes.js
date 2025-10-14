const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notification.controller");
const { authenticate } = require("../middlewares/auth.middleware");

// Toutes les routes nécessitent un utilisateur connecté
router.use(authenticate);

// 📩 Récupérer toutes les notifications reçues
router.get("/", notificationController.getReceptions);

// ✅ Marquer une notification comme lue
router.put("/:id/lire", notificationController.marquerCommeLue);

module.exports = router;
