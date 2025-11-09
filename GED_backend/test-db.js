const pool = require('./src/models/db'); // adapte selon ton projet

async function testConnection() {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('Connexion réussie ! Heure actuelle DB :', res.rows[0]);
    process.exit(0);
  } catch (err) {
    console.error('Erreur connexion DB :', err);
    process.exit(1);
  }
}

testConnection();
