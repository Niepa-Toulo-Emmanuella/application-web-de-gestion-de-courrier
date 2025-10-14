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

module.exports = uploadToB2;
