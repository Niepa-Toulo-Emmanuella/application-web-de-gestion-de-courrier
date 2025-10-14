const b2 = require('../config/b2');

async function uploadFileToB2(file) {
  if (!file || !file.buffer) {
    throw new Error('Le fichier ou le buffer est manquant');
  }

  const params = {
    Bucket: process.env.B2_BUCKET_NAME,
    Key: `${Date.now()}_${file.originalname}`,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  try {
    const data = await b2.upload(params).promise();
    return data.Location || data.Key; // selon ce que renvoie Backblaze
  } catch (error) {
    console.error('Erreur upload Backblaze:', error);
    throw error;
  }
}

module.exports = { uploadFileToB2 };
