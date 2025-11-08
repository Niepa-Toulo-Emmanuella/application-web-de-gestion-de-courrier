// src/helpers/b2upload.js
require('dotenv').config();
const fs = require('fs');
const AWS = require('aws-sdk');

// ✅ Configuration correcte du client S3 compatible Backblaze B2
const s3 = new AWS.S3({
  endpoint: new AWS.Endpoint(process.env.B2_ENDPOINT),
  region: process.env.B2_REGION,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APP_KEY
  },
  signatureVersion: 'v4'
});

/**
 * ✅ Upload d’un fichier local vers Backblaze B2
 * @param {string} localPath - Chemin local du fichier
 * @param {string} fileName - Nom du fichier sur B2 (ex: archives/2024/courrier_123/file.pdf)
 * @param {string} mimeType - Type MIME du fichier
 */


// ✅ Fonction d’upload vers B2
async function uploadToB2(localPath, fileName, mimeType) {
  try {
    console.log("📤 Upload vers B2 :", fileName);

    const fileBuffer = fs.readFileSync(localPath);

    const params = {
      Bucket: process.env.B2_BUCKET_NAME,
      Key: fileName,
      Body: fileBuffer,
      ContentType: mimeType
    };

    await s3.upload(params).promise();

    console.log("✅ Upload réussi sur Backblaze B2 :", fileName);

    // 🔗 Génération du lien public
    const endpoint = process.env.B2_ENDPOINT.replace(/^https?:\/\//, '');
    return `https://${endpoint}/${process.env.B2_BUCKET_NAME}/${fileName}`;
  } catch (error) {
    console.error("❌ Erreur lors de l’upload sur B2 :", error);
    throw error;
  }
}

/**
 * 🧠 Upload d’un Buffer directement (sans fichier local)
 * Utile pour générer un PDF en mémoire avant de l’envoyer sur B2
 */
async function uploadBufferToB2(buffer, fileName, mimeType = 'application/octet-stream') {
  try {
    console.log("📤 Upload buffer vers B2 :", fileName);

    const params = {
      Bucket: process.env.B2_BUCKET_NAME,
      Key: fileName,
      Body: buffer,
      ContentType: mimeType
    };

    await s3.upload(params).promise();

    const endpoint = process.env.B2_ENDPOINT.replace(/^https?:\/\//, '');
    return `https://${endpoint}/${process.env.B2_BUCKET_NAME}/${fileName}`;
  } catch (error) {
    console.error("❌ Erreur lors de l’upload buffer :", error);
    throw error;
  }
}

/**
 * 🔍 Vérifie si un fichier existe déjà sur B2
 */
async function fileExistsOnB2(fileName) {
  try {
    const params = {
      Bucket: process.env.B2_BUCKET_NAME,
      Key: fileName
    };
    await s3.headObject(params).promise();
    return true; // ✅ Le fichier existe
  } catch (error) {
    if (error.code === 'NotFound') return false;
    console.error("❌ Erreur de vérification d’existence :", error);
    throw error;
  }
}

/**
 * 🧩 Extrait la clé B2 depuis une URL publique
 * Ex: https://bucket.s3.us-east-005.backblazeb2.com/path/to/file.pdf
 * => retourne "path/to/file.pdf"
 */
function urlToB2Key(fileUrl) {
  try {
    const u = new URL(fileUrl);
    const idx = u.pathname.indexOf(process.env.B2_BUCKET_NAME);
    if (idx >= 0) {
      return decodeURIComponent(u.pathname.slice(idx + process.env.B2_BUCKET_NAME.length + 1));
    }
    return decodeURIComponent(u.pathname.replace(/^\//, ''));
  } catch (err) {
    // si fileUrl n'est pas une vraie URL
    return fileUrl;
  }
}


module.exports = {
  uploadToB2,
  uploadBufferToB2,
  fileExistsOnB2,
  urlToB2Key
};

