// archive.routes.js
const express = require('express');
const router = express.Router();
const stream = require('stream');
const archiver = require('archiver');
const cors = require('cors');
const { verifyToken, hasRole } = require('../middlewares/auth.middleware');
const { objectExistsInB2, s3 } = require('../helpers/archive.helpers');

// Appliquer CORS sur toutes les routes du router
router.use(cors({
  origin: [
    "https://www.jurimail.site",
    "https://jurimail.site"
  ],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));

router.get('/signed-url/:year', verifyToken, hasRole(['agent']), async (req, res) => {
  console.log('💡 Rôle utilisateur avant hasRole:', req.user.role);
  try {
    const year = req.params.year;
    const zipKey = `archives/${year}/archive_${year}_temp.zip`;

    // Vérifier si le ZIP existe déjà
    const exists = await objectExistsInB2(zipKey);
    if (exists) {
      const url = s3.getSignedUrl('getObject', { Bucket: process.env.B2_BUCKET_NAME, Key: zipKey, Expires: 600 });
      return res.json({ url });
    }

    // Créer le ZIP en excluant le ZIP lui-même
    const list = await s3.listObjectsV2({ Bucket: process.env.B2_BUCKET_NAME, Prefix: `archives/${year}/` }).promise();
    if (!list.Contents || list.Contents.length === 0) return res.status(404).json({ message: "Aucun fichier trouvé" });

    const filesToZip = list.Contents.filter(f => !f.Key.endsWith(`archive_${year}_temp.zip`));

    const archiveStream = new stream.PassThrough();
    const uploadPromise = s3.upload({ Bucket: process.env.B2_BUCKET_NAME, Key: zipKey, Body: archiveStream, ContentType: 'application/zip' }).promise();
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(archiveStream);

    for (const obj of filesToZip) {
      const fileStream = s3.getObject({ Bucket: process.env.B2_BUCKET_NAME, Key: obj.Key }).createReadStream();
      archive.append(fileStream, { name: obj.Key.replace(`archives/${year}/`, '') });
    }

    await archive.finalize();
    await uploadPromise;

    const url = s3.getSignedUrl('getObject', { Bucket: process.env.B2_BUCKET_NAME, Key: zipKey, Expires: 600 });
    res.json({ url });

  } catch (err) {
    console.error('Erreur génération ZIP :', err);
    res.status(500).json({ success: false, message: "Erreur génération ZIP", error: err.message });
  }
});

module.exports = router;
