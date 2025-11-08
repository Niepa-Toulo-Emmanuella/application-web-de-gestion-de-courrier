// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const fetch = require('node-fetch'); // ✅ Nécessaire pour télécharger les fichiers distants

const pool = require('./src/models/db');
const transporter = require('./src/config/mail');

const app = express();

// ✅ Ajoute ceci :
app.set('trust proxy', 1); // Rend Render ou Nginx digne de confiance pour l'IP client

// 🌐 CORS — autoriser ton frontend
app.use(cors({
  origin: [
    "https://application-web-de-gestion-de-courrier-1.onrender.com",
    "https://application-web-de-gestion-de-courrier.onrender.com"
  ],
  credentials: true,
}));

// ✅ Important pour les requêtes OPTIONS (préflight)
app.options('*', cors());

// 📧 Test d’envoi d’e-mail
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
const archiveRoutes = require('./src/routes/archive.routes');

// 🔐 Sécurité
app.use(helmet());

// ✅ Autoriser ton frontend à afficher des iframes avec bordereaux
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "frame-ancestors 'self' https://application-web-de-gestion-de-courrier.onrender.com https://application-web-de-gestion-de-courrier-1.onrender.com"
  );
  next();
});

// 📦 Middleware parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 🚦 Routes principales
app.use('/api/auth', authRoutes);
app.use('/api/courriers', courrierRoutes);
app.use('/api/bordereaux', bordereauRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/envoyer', envoyerRoutes);
app.use('/api/imputations', imputationRoutes);
app.use('/api/archives', archiveRoutes);


// === ROUTES DE TÉLÉCHARGEMENT === //
const router = express.Router();

// === ROUTES DE TÉLÉCHARGEMENT AVEC LOGS ===

// 📁 1️⃣ Fichier scanné (hébergé sur S3 / B2)
// 📁 Téléchargement fichier scanné via query ?url=
// Téléchargement via redirect direct
router.get("/api/courriers/download", async (req, res) => {
  const fileUrl = req.query.url;
  if (!fileUrl) return res.status(400).json({ success: false, message: "URL manquante" });

  try {
    const decodedUrl = decodeURIComponent(fileUrl);

    // Si c'est déjà une URL complète (http/https)
    const finalUrl = decodedUrl.startsWith("http")
      ? decodedUrl
      : `https://s3.us-east-005.backblazeb2.com/CourrierBucket2/${decodedUrl}`;

    console.log("📥 Redirection vers :", finalUrl);

    // Rediriger le client vers le fichier pour téléchargement
    res.redirect(finalUrl);

  } catch (err) {
    console.error("❌ Erreur téléchargement fichier :", err);
    res.status(500).json({ success: false, message: "Fichier introuvable" });
  }
});


// 📄 2️⃣ Fichier d’imputation
router.get("/api/imputations/download/:fileName", async (req, res) => {
  const { fileName } = req.params;
  try {
    const fileUrl = decodeURIComponent(fileName);
    console.log("📥 Téléchargement du fichier d’imputation :", fileUrl);

    const finalUrl = fileUrl.startsWith("http")
      ? fileUrl
      : `https://s3.us-east-005.backblazeb2.com/CourrierBucket2/${fileUrl}`;

    const response = await fetch(finalUrl);
    if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);

    const buffer = await response.arrayBuffer();
    res.setHeader("Content-Disposition", `attachment; filename="${finalUrl.split('/').pop()}"`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error("❌ Erreur téléchargement imputation :", err);
    res.status(500).json({ success: false, message: "Erreur téléchargement imputation" });
  }
});


// 🧾 3️⃣ Fichier bordereau
router.get("/api/bordereaux/download/:fileName", async (req, res) => {
  const { fileName } = req.params;
  try {
    const fileUrl = decodeURIComponent(fileName);
    console.log("📥 Téléchargement du fichier bordereau :", fileUrl);

    const finalUrl = fileUrl.startsWith("http")
      ? fileUrl
      : `https://s3.us-east-005.backblazeb2.com/CourrierBucket2/${fileUrl}`;

    const response = await fetch(finalUrl);
    if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);

    const buffer = await response.arrayBuffer();
    res.setHeader("Content-Disposition", `attachment; filename="${finalUrl.split('/').pop()}"`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error("❌ Erreur téléchargement bordereau :", err);
    res.status(500).json({ success: false, message: "Erreur téléchargement bordereau" });
  }
});

app.use(router);
// === FIN DES ROUTES DE TÉLÉCHARGEMENT === //

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

// 🚀 Lancement du serveur
// Démarrage correct du serveur avec timeout désactivé
const server = app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`📍 URL: http://localhost:${PORT}`);
});

// Désactive le timeout HTTP (utile pour gros fichiers ZIP)
server.timeout = 0;
