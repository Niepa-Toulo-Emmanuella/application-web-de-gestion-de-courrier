// const express = require('express');
// const cors = require('cors');
// const helmet = require('helmet');
// const cookieParser = require('cookie-parser');
// require('dotenv').config();
// const path = require('path');

// const authRoutes = require('./src/routes/auth');

// const app = express();
// const PORT = process.env.PORT || 3000;

// // Servir les fichiers statiques (HTML, CSS, JS dans /public)
// app.use(express.static(path.join(__dirname, 'public')));

// // Configuration CORS pour accepter plusieurs origines (ex: localhost et IP locale)
// const allowedOrigins = [
//   process.env.FRONTEND_URL || 'http://localhost:3000',
//   'http://192.168.1.68:3000', // ajoute ici toutes les origines de ton frontend si besoin
// ];

// app.use(cors({
//   origin: function(origin, callback) {
//     // Autoriser les requêtes sans origin (ex: Postman ou même navigateur local file)
//     if (!origin) return callback(null, true);
//     if (allowedOrigins.indexOf(origin) === -1) {
//       const msg = `L'origine CORS ${origin} n'est pas autorisée.`;
//       return callback(new Error(msg), false);
//     }
//     return callback(null, true);
//   },
//   credentials: true,
// }));

// // Gestion des requêtes OPTIONS pour CORS (préflight)
// app.options('*', cors());

// // Middleware de sécurité
// app.use(helmet());

// // Middleware de parsing
// app.use(express.json({ limit: '10mb' }));
// app.use(express.urlencoded({ extended: true }));
// app.use(cookieParser());

// // Routes
// app.use('/api/auth', authRoutes);

// // Route de test
// app.get('/api/health', (req, res) => {
//   res.json({ 
//     success: true, 
//     message: 'Server is running',
//     timestamp: new Date().toISOString()
//   });
// });

// // Gestion des erreurs 404
// app.use('*', (req, res) => {
//   res.status(404).json({
//     success: false,
//     message: 'Route non trouvée'
//   });
// });

// // Gestion globale des erreurs
// app.use((error, req, res, next) => {
//   console.error('Erreur globale:', error.message);
//   if (error.message && error.message.includes('CORS')) {
//     return res.status(403).json({
//       success: false,
//       message: error.message
//     });
//   }
//   res.status(500).json({
//     success: false,
//     message: 'Erreur interne du serveur'
//   });
// });

// app.listen(PORT, () => {
//   console.log(`🚀 Serveur démarré sur le port ${PORT}`);
//   console.log(`📍 URL: http://localhost:${PORT}`);
// });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const path = require('path');

const authRoutes = require('./src/routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/api/auth', authRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});
