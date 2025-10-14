const AWS = require('aws-sdk');
require('dotenv').config(); // important

console.log("Bucket utilisé :", process.env.B2_BUCKET_NAME);

const s3 = new AWS.S3({
  endpoint: process.env.B2_ENDPOINT,
  accessKeyId: process.env.B2_KEY_ID,
  secretAccessKey: process.env.B2_APP_KEY,
});

async function listFiles() {
  try {
    const data = await s3.listObjectsV2({ Bucket: process.env.B2_BUCKET_NAME }).promise();
    if (!data.Contents || data.Contents.length === 0) {
      console.log("Le bucket est vide");
      return;
    }

    console.log("Fichiers présents dans le bucket :");
    data.Contents.forEach(f => console.log(f.Key));
  } catch (err) {
    console.error("Erreur :", err);
  }
}

listFiles();
