require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const pool = require('./src/models/db');
const transporter = require('./src/config/mail');

const app = express();
// 🌐 CORS
// Autoriser uniquement ton frontend
// ✅ CORS ici, dans server.js
app.use(cors({
  origin: [
    "https://application-web-de-gestion-de-courrier-1.onrender.com",
    "http://localhost:3000"
  ],
  credentials: true,
}));

app.get('/test-mail', async (req, res) => {
  try {
    await transporter.sendMail({
      from: `"Test SGE" <${process.env.SMTP_USER}>`,
      to: 'niepemmanuella29@gmail.com',
      subject: 'Test de mail SMTP',
      text: 'Ceci est un test.',
    });
    res.send('Email envoyé avec succès !');
  } catch (err) {
    console.error('Erreur mail:', err);
    res.status(500).send('Erreur envoi mail');
  }
});
app.use(express.json());
app.use(cookieParser());

// ✅ Test connexion PostgreSQL
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Erreur de connexion PostgreSQL :', err.message);
  } else {
    console.log('✅ Connexion PostgreSQL réussie :', res.rows);
  }
});

// 🔗 Import des routes
const authRoutes = require('./src/routes/auth.routes');
const courrierRoutes = require('./src/routes/courrier.routes');
const bordereauRoutes = require('./src/routes/bordereau.routes');
const notificationRoutes = require('./src/routes/notification.routes');
const userRoutes = require('./src/routes/user.routes');
const envoyerRoutes = require('./src/routes/envoyer.routes');
const imputationRoutes = require('./src/routes/imputation.routes');




// 🔐 Sécurité
app.use(helmet());

// 📦 Middleware parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 🚦 Routes
app.use('/api/auth', authRoutes);
app.use('/api/courriers', courrierRoutes);
app.use('/api/bordereaux', bordereauRoutes);

app.use('/api/notifications', notificationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/envoyer', envoyerRoutes);
app.use('/api/imputations', imputationRoutes);


// 🔍 Route de test
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

app.get('/testdb', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.send(`✅ Connexion réussie : ${result.rows[0].now}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('❌ Erreur de connexion à la base');
  }
});


// ❌ Routes inconnues
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route non trouvée'
  });
});

// 💥 Gestion des erreurs
app.use((err, req, res, next) => {
  console.error('Erreur globale:', err);
  res.status(500).json({
    success: false,
    message: 'Erreur interne du serveur'
  });
});

const PORT = process.env.PORT || 3000;
// 🚀 Lancement
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`📍 URL: http://localhost:${PORT}`);
});
