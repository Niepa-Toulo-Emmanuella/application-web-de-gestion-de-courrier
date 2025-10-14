const AWS = require('aws-sdk');

const b2 = new AWS.S3({
  endpoint: process.env.B2_ENDPOINT, // ex: "https://s3.us-east-005.backblazeb2.com"
  accessKeyId: process.env.B2_APPLICATION_KEY_ID,
  secretAccessKey: process.env.B2_APPLICATION_KEY,
  region: process.env.B2_REGION || 'us-east-005', // souvent laissé tel quel
  signatureVersion: 'v4',
  s3ForcePathStyle: true, // IMPORTANT pour Backblaze B2
});

module.exports = b2;
