// utils/mail.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: +process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true', // true si 465
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

async function sendOtpEmail(to, otp, context = {}) {
  const html = `
    <p>Bonjour,</p>
    <p>Votre code de signature est : <strong>${otp}</strong></p>
    <p>Ce code expire dans ${context.expiresMinutes || 10} minutes.</p>
  `;
  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject: 'Code OTP pour signature de bordereau',
    html
  });
}

module.exports = { sendOtpEmail };
