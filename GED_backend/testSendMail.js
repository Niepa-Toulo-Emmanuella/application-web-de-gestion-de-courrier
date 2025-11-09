// testSendMail.js
require('dotenv').config(); // Charge les variables d'environnement depuis .env
const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const testEmail = async () => {
  try {
    await sgMail.send({
      to: 'ton-email@test.com',          // Remplace par ton email réel pour recevoir le test
      from: process.env.FROM_EMAIL,      // L'email vérifié dans SendGrid
      subject: 'Test SendGrid local',
      text: 'Ceci est un test d’envoi d’email depuis Node.js en local.',
      html: '<strong>Ceci est un test d’envoi d’email depuis Node.js en local.</strong>'
    });
    console.log('✅ E-mail de test envoyé avec succès !');
  } catch (err) {
    console.error('❌ Erreur lors de l’envoi du mail :', err.response?.body || err);
  }
};

testEmail();
