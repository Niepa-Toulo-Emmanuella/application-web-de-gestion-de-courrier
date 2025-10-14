const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: 'courrier_postgresql_emma_user',
  host: 'dpg-d0hd9j3uibrs739khlpg-a.oregon-postgres.render.com',
  database: 'courrier_postgresql_emma',
  password: 'PApa@2932',
  port: 5432,
  ssl: {
    rejectUnauthorized: false,
  },
});


// Test de connexion
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Database connection error:', err);
});


module.exports = pool;