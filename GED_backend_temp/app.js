// require('dotenv').config();
// const express = require('express');
// const cors = require('cors');
// const db = require('./src/models/db');

// const authRoutes = require('./src/routes/auth.routes');
// const userRoutes = require('./src/routes/user.routes');
// const courrierRoutes = require('./src/routes/courrier.routes');
// const pieceJointeRoutes = require("./src/routes/piecesJointes.routes");
// const bordereauRoutes = require("./src/routes/bordereaux.routes");

// const app = express();

// app.use(cors());
// app.use(express.json());

// // Routes principales
// app.use('/api/auth', authRoutes);
// app.use('/api/users', userRoutes);
// app.use('/api/courriers', courrierRoutes);
// app.use('/api/pieces-jointes', pieceJointeRoutes); // 🔄 changer le préfixe ici
// app.use('/api/bordereaux', bordereauRoutes);

// // Test API
// app.get('/', (req, res) => res.send('GED API is running'));

// // Test route destinataires
// app.get('/api/destinataires', async (req, res) => {
//   try {
//     const result = await db.query('SELECT id, nom, email FROM destinataires ORDER BY nom');
//     res.json(result.rows);
//   } catch (err) {
//     console.error('Erreur récupération destinataires:', err);
//     res.status(500).json({ error: 'Erreur serveur lors de la récupération des destinataires' });
//   }
// });

// module.exports = app;
