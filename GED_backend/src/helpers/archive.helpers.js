// src/helpers/archive.helpers.js
const AWS = require('aws-sdk');
const s3 = new AWS.S3({
  endpoint: process.env.B2_ENDPOINT,
  accessKeyId: process.env.B2_KEY_ID,
  secretAccessKey: process.env.B2_APP_KEY,
  region: process.env.B2_REGION,
  s3ForcePathStyle: true,
});
const mime = require('mime-types');

function urlToB2Key(fileUrl) {
  try {
    const u = new URL(fileUrl);
    const idx = u.pathname.indexOf(process.env.B2_BUCKET_NAME);
    if (idx >= 0) {
      return decodeURIComponent(u.pathname.slice(idx + process.env.B2_BUCKET_NAME.length + 1));
    }
    return decodeURIComponent(u.pathname.replace(/^\//, ''));
  } catch (err) {
    return fileUrl; // si ce n'est pas une URL, on suppose que c'est déjà la clé
  }
}

async function uploadBufferToB2(bufferOrStream, key, contentType = 'application/octet-stream') {
  const params = {
    Bucket: process.env.B2_BUCKET_NAME,
    Key: key,
    Body: bufferOrStream,
    ContentType: contentType,
  };
  await s3.putObject(params).promise();
  return `https://${process.env.B2_BUCKET_NAME}.s3.us-east-005.backblazeb2.com/${encodeURIComponent(key)}`;
}

module.exports = { urlToB2Key, uploadBufferToB2 };
