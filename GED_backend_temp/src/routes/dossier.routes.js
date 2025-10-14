// const express = require("express");
// const router = express.Router();
// const dossierController = require("../controllers/dossier.controller");
// const verifyToken = require("../middlewares/auth.middleware")(); // 🔒 Ajout manquant

// // 📁 Créer un dossier
// router.post("/", verifyToken, dossierController.createDossier);

// // 📂 Obtenir tous les dossiers
// router.get("/", verifyToken, dossierController.getDossiers);


// // 🔍 Obtenir un dossier par ID
// router.get("/:id", verifyToken, dossierController.getDossierById);

// // ✏️ Mettre à jour un dossier
// router.put("/:id", verifyToken, dossierController.updateDossier);

// // 🗑️ Supprimer un dossier
// router.delete("/:id", verifyToken, dossierController.deleteDossier);

// // 🔗 Associer un courrier à un dossier (si tu as la fonction dans le contrôleur)
// router.put("/:id/associer-courrier/:courrier_id", verifyToken, dossierController.associerCourrier);

// module.exports = router;
