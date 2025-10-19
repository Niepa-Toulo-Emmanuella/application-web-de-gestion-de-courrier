const sgMail = require('@sendgrid/mail');
require('dotenv').config();

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendResetEmail(to, token) {
  const resetLink = `https://application-web-de-gestion-de-courrier-1.onrender.com/reset-password.html?token=${token}`;

  const msg = {
    to,
    from: process.env.FROM_EMAIL, // email vérifié sur SendGrid
    subject: 'Réinitialisation de votre mot de passe',
    html: `
      <h3>Réinitialisation de mot de passe</h3>
      <p>Pour réinitialiser votre mot de passe, cliquez sur le lien ci-dessous :</p>
      <a href="${resetLink}">${resetLink}</a>
      <p>Ce lien expirera dans 10 minutes.</p>
    `,
  };

  await sgMail.send(msg);
  console.log('✅ E-mail de réinitialisation envoyé à', to);
}

module.exports = sendResetEmail;
