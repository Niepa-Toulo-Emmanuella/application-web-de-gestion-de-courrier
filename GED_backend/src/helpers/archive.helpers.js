// src/helpers/archive.helpers.js
const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const stream = require('stream');
const archiver = require('archiver');

// Configuration du client S3 pour Backblaze B2
const s3 = new AWS.S3({
  endpoint: process.env.B2_ENDPOINT,        // ex: https://s3.us-east-005.backblazeb2.com
  accessKeyId: process.env.B2_KEY_ID,
  secretAccessKey: process.env.B2_APP_KEY,
  region: process.env.B2_REGION || 'us-east-1',
  s3ForcePathStyle: true,
});

/**
 * Upload d'un fichier local vers B2 en conservant son nom d'origine
 * @param {string} localFilePath - Chemin local du fichier
 * @param {string} b2Key - Chemin/fichier dans le bucket (ex: archives/2025/1/fichier.pdf)
 * @returns {Promise<string>} URL publique du fichier
 */
async function uploadToB2(localFilePath, b2Key) {
  const contentType = mime.lookup(localFilePath) || 'application/octet-stream';
  const fileStream = fs.createReadStream(localFilePath);

  const params = {
    Bucket: process.env.B2_BUCKET_NAME,
    Key: b2Key,
    Body: fileStream,
    ContentType: contentType,
  };

  await s3.putObject(params).promise();

  // Retourne l'URL publique du fichier uploadé
  return `https://${process.env.B2_BUCKET_NAME}.s3.us-east-005.backblazeb2.com/${encodeURIComponent(b2Key)}`;
}

/**
 * Vérifie si un fichier existe déjà dans B2
 * @param {string} b2Key
 * @returns {Promise<boolean>}
 */
async function objectExistsInB2(b2Key) {
  try {
    await s3.headObject({ Bucket: process.env.B2_BUCKET_NAME, Key: b2Key }).promise();
    return true;
  } catch (err) {
    if (err.code === 'NotFound') return false;
    throw err;
  }
}

/**
 * Génère une URL signée pour télécharger un fichier
 * @param {string} b2Key
 * @param {number} expires - durée de validité en secondes (default 600)
 */
function getSignedUrlB2(b2Key, expires = 600) {
  return s3.getSignedUrl('getObject', {
    Bucket: process.env.B2_BUCKET_NAME,
    Key: b2Key,
    Expires: expires,
  });
}

/**
 * Met à jour le ZIP annuel en incluant tous les fichiers archivés de l'année.
 */
async function updateYearZip(year) {
  const zipKey = `archives/${year}/archive_${year}_temp.zip`;

  const list = await s3.listObjectsV2({
    Bucket: process.env.B2_BUCKET_NAME,
    Prefix: `archives/${year}/`
  }).promise();

  if (!list.Contents || list.Contents.length === 0) return;

  // Exclure le ZIP lui-même
  const filesToZip = list.Contents.filter(f => !f.Key.endsWith(`archive_${year}_temp.zip`));

  const archiveStream = new stream.PassThrough();
  const uploadPromise = s3.upload({
    Bucket: process.env.B2_BUCKET_NAME,
    Key: zipKey,
    Body: archiveStream,
    ContentType: 'application/zip'
  }).promise();

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(archiveStream);

  for (const obj of filesToZip) {
    const fileStream = s3.getObject({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: obj.Key
    }).createReadStream();

    const zipPath = obj.Key.replace(`archives/${year}/`, '');
    archive.append(fileStream, { name: zipPath });
  }

  await archive.finalize();
  await uploadPromise;
}


module.exports = {
  uploadToB2,
  objectExistsInB2,
  getSignedUrlB2,
  s3,
  updateYearZip,
};
