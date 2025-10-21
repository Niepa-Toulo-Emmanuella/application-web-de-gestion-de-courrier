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
    "http://localhost:3000"
  ],
  credentials: true,
}));

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

// 🔐 Sécurité
app.use(helmet());

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



// === ROUTES DE TÉLÉCHARGEMENT === //
const router = express.Router();

// 1️⃣ Fichier scanné
router.get("/api/courriers/download/:fileName", async (req, res) => {
  const { fileName } = req.params;
  console.log("📥 [Téléchargement COURRIER] Nom du fichier reçu :", fileName);

  try {
    const fileUrl = decodeURIComponent(fileName);
    console.log("🌍 URL décodée :", fileUrl);

    const response = await fetch(fileUrl);

    if (!response.ok) {
      console.error("❌ Erreur lors du téléchargement du fichier scanné :", response.status, response.statusText);
      return res.status(500).json({ success: false, message: "Fichier scanné inaccessible" });
    }

    const buffer = await response.arrayBuffer();
    console.log("✅ Fichier scanné récupéré avec succès :", fileUrl.split('/').pop());

    res.setHeader("Content-Disposition", `attachment; filename="${fileUrl.split('/').pop()}"`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error("💥 Erreur dans la route /api/courriers/download :", err);
    res.status(500).json({ success: false, message: "Erreur téléchargement courrier" });
  }
});

// 2️⃣ Fichier d’imputation
router.get("/api/imputations/download/:fileName", async (req, res) => {
  const { fileName } = req.params;
  console.log("📥 [Téléchargement IMPUTATION] Nom du fichier reçu :", fileName);

  try {
    const fileUrl = decodeURIComponent(fileName);
    console.log("🌍 URL décodée :", fileUrl);

    const response = await fetch(fileUrl);

    if (!response.ok) {
      console.error("❌ Erreur lors du téléchargement du fichier d’imputation :", response.status, response.statusText);
      return res.status(500).json({ success: false, message: "Fichier d’imputation inaccessible" });
    }

    const buffer = await response.arrayBuffer();
    console.log("✅ Fichier d’imputation récupéré avec succès :", fileUrl.split('/').pop());

    res.setHeader("Content-Disposition", `attachment; filename="${fileUrl.split('/').pop()}"`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error("💥 Erreur dans la route /api/imputations/download :", err);
    res.status(500).json({ success: false, message: "Erreur téléchargement imputation" });
  }
});

// 3️⃣ Fichier bordereau
router.get("/api/bordereaux/download/:fileName", async (req, res) => {
  const { fileName } = req.params;
  console.log("📥 [Téléchargement BORDEREAU] Nom du fichier reçu :", fileName);

  try {
    const fileUrl = decodeURIComponent(fileName);
    console.log("🌍 URL décodée :", fileUrl);

    const response = await fetch(fileUrl);

    if (!response.ok) {
      console.error("❌ Erreur lors du téléchargement du fichier bordereau :", response.status, response.statusText);
      return res.status(500).json({ success: false, message: "Fichier bordereau inaccessible" });
    }

    const buffer = await response.arrayBuffer();
    console.log("✅ Fichier bordereau récupéré avec succès :", fileUrl.split('/').pop());

    res.setHeader("Content-Disposition", `attachment; filename="${fileUrl.split('/').pop()}"`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error("💥 Erreur dans la route /api/bordereaux/download :", err);
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
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`📍 URL: http://localhost:${PORT}`);
});
