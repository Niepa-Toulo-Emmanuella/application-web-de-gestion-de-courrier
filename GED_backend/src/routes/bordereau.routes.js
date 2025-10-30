// bordereau.routes
const express = require('express');
const router = express.Router();
const AWS = require('aws-sdk');
const multer = require('multer');

const bordereauController = require('../controllers/bordereau.controller');
const envoyerController = require('../controllers/envoyer.controller');
const { authenticate, isAdmin } = require('../middlewares/auth.middleware');

const upload = multer({ storage: multer.memoryStorage() });

// ---------------- CONFIGURATION S3 BACKBLAZE B2 ----------------
const s3 = new AWS.S3({
  endpoint: new AWS.Endpoint(process.env.B2_ENDPOINT),
  accessKeyId: process.env.B2_KEY_ID,
  secretAccessKey: process.env.B2_APP_KEY,
});

// ---------------- ROUTES PUBLIQUES (téléchargement des fichiers) ----------------

// Télécharger un PDF de bordereau
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

// Télécharger un courrier
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

// ---------------- MIDDLEWARE AUTH ----------------
router.use(authenticate); // toutes les routes suivantes nécessitent authentification

// ---------------- ROUTES BORDEREAUX ----------------
// router.get('/registre-transmission', bordereauController.registreTransmission);

router.get('/registre-transmission', (req, res, next) => {
  console.log('✅ Route registre-transmission atteinte');
  console.log('Token reçu :', req.headers.authorization);
  next(); // passe au controller
}, bordereauController.registreTransmission);


router.get('/', bordereauController.list);
router.get('/:id', bordereauController.detail);

// Création bordereau (avec ou sans fichier)
router.post('/', bordereauController.create);
router.post('/create', upload.single('fichier_bordereau'), bordereauController.create);

// Transmission bordereau
router.post('/transmettreBordereau', bordereauController.transmettreBordereau);

// ---------------- ROUTES ENVOIS ----------------
router.get("/mes-envois", envoyerController.getEnvoisPourDestinataire);

// ---------------- ADMIN ----------------
router.delete('/:id', isAdmin, bordereauController.remove);

module.exports = router;
