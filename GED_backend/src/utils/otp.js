// utils/otp.js
const crypto = require('crypto');

function generateOtp(length = 6) {
  // chiffres uniquement
  const otp = ('' + Math.floor(Math.random() * Math.pow(10, length))).padStart(length, '0');
  return otp;
}

function hashOtp(otp) {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

module.exports = { generateOtp, hashOtp };
