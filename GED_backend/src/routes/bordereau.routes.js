const express = require('express');
const router = express.Router();
const AWS = require('aws-sdk');

const bordereauController = require('../controllers/bordereau.controller');
const envoyerController = require('../controllers/envoyer.controller');
const { authenticate, isAdmin } = require('../middlewares/auth.middleware');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// ⚙️ Configuration du client S3 pour Backblaze B2
const s3 = new AWS.S3({
  endpoint: new AWS.Endpoint(process.env.B2_ENDPOINT),
  accessKeyId: process.env.B2_KEY_ID,
  secretAccessKey: process.env.B2_APP_KEY,
});

// ---------------- ROUTES DE TÉLÉCHARGEMENT ----------------

// 📄 Télécharger un PDF de bordereau
router.get('/download/:fileName', async (req, res) => {
  try {
    const fileName = req.params.fileName;
    const params = { Bucket: process.env.B2_BUCKET_NAME, Key: fileName };
    const data = await s3.getObject(params).promise();

    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', data.ContentType || 'application/pdf');
    res.send(data.Body);
  } catch (err) {
    console.error('❌ Erreur téléchargement bordereau :', err);
    res.status(500).send("Erreur lors du téléchargement du bordereau");
  }
});

// ⚠️ Si tu veux aussi gérer les fichiers de courriers, tu peux créer une route similaire
router.get('/courriers/download/:fileName', async (req, res) => {
  try {
    const fileName = req.params.fileName;
    const params = { Bucket: process.env.B2_BUCKET_NAME, Key: fileName };
    const data = await s3.getObject(params).promise();

    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', data.ContentType || 'application/octet-stream');
    res.send(data.Body);
  } catch (err) {
    console.error('❌ Erreur téléchargement courrier :', err);
    res.status(500).send("Erreur lors du téléchargement du courrier");
  }
});

// ---------------- AUTHENTIFICATION ----------------
router.use(authenticate);

// ---------------- ROUTES BORDEREAUX ----------------
router.get('/', bordereauController.list);
router.get('/:id', bordereauController.detail);
router.post('/transmettreBordereau', bordereauController.transmettreBordereau);
router.post('/', bordereauController.create);
router.post('/create', upload.single('fichier_bordereau'), bordereauController.create);

// ---------------- ROUTES ENVOIS ----------------
router.get("/mes-envois", envoyerController.getEnvoisPourDestinataire);

router.get('/registre-transmission', bordereauController.registreTransmission);


// ---------------- ADMIN ----------------
router.delete('/:id', isAdmin, bordereauController.remove);

module.exports = router;
