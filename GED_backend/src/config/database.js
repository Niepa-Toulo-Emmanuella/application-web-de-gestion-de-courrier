// const { Pool } = require('pg');
// require('dotenv').config();

// const pool = new Pool({
//   user: process.env.DB_USER,
//   host: process.env.DB_HOST,
//   database: process.env.DB_NAME,
//   password: process.env.DB_PASSWORD,
//   port: parseInt(process.env.DB_PORT || '5432', 10),
//   ssl: { rejectUnauthorized: false } // nécessaire avec Render
// });





// pool.connect()
//   .then(() => console.log('✅ Connexion PostgreSQL réussie'))
//   .catch(err => console.error('❌ Erreur de connexion PostgreSQL :', err.message));


// // Test de connexion
// pool.on('connect', () => {
//   console.log('Connected to PostgreSQL database');
// });

// pool.on('error', (err) => {
//   console.error('Database connection error:', err);
// });

// module.exports = pool;