// src/routes/courrier.routes.js
const express = require('express');
const multer  = require('multer');
const AWS = require('aws-sdk');




const { authenticate } = require('../middlewares/auth.middleware');
const { isAdmin } = require('../middlewares/auth.middleware'); // si tu réserves DELETE aux admins
const ctrl = require('../controllers/courrier.controller');


const router = express.Router();
const upload = multer({ dest: 'uploads/' });   // dossier où sont stockés les scans

// ⚡ Config B2 S3-compatible avec nouvelle clé
const s3 = new AWS.S3({
  endpoint: process.env.B2_ENDPOINT,
  region: process.env.B2_REGION,
  accessKeyId: process.env.B2_KEY_ID,
  secretAccessKey: process.env.B2_APP_KEY,
});


// ================= ROUTE DE TÉLÉCHARGEMENT =================
router.get("/:id/download", authenticate, async (req, res) => {
  try {
    const courrierId = req.params.id;

    // Récupérer les infos du courrier depuis la DB
    const courrier = await ctrl.detailForDownload(courrierId);
    if (!courrier || !courrier.fichier_scan) {
      return res.status(404).json({ success: false, message: "Fichier introuvable" });
    }

    // Extraction du nom de fichier
    const fileKey = courrier.fichier_scan.split('/').pop();

    const params = {
      Bucket: process.env.B2_BUCKET_NAME,
      Key: fileKey
    };

    // Lecture complète avant envoi (évite les erreurs headers)
    const data = await s3.getObject(params).promise();

    res.setHeader("Content-Disposition", `attachment; filename="${fileKey}"`);
    res.setHeader("Content-Type", data.ContentType || "application/octet-stream");
    res.send(data.Body);

  } catch (err) {
    console.error("❌ Erreur téléchargement courrier :", err);
    res.status(500).send("Erreur lors du téléchargement du courrier");
  }
});
/* -------------------- Routes protégées par JWT -------------------- */
router.use(authenticate); // tout ce qui suit nécessite connexion

router.get('/', ctrl.list);
router.get("/:id/download", authenticate, ctrl.download);
router.get('/:id', ctrl.detail);
router.post('/', upload.single('scan'), ctrl.create);
router.put('/:id', upload.single('scan'), ctrl.update);




/* DELETE réservé aux admins, sinon enlève isAdmin */
router.delete('/:id', authenticate, ctrl.remove);

router.get("/:id/download", authenticate, ctrl.download);

// Téléchargement sécurisé
router.get('/download-secure/:courrierId', ctrl.secureDownload);

// src/routes/courriers.routes.js
router.get('/download/:key', ctrl.download);


module.exports = router;
