// db.js
require('dotenv').config();
const { Pool } = require('pg');

let pool;

// ✅ Connexion Render / production si DATABASE_URL défini
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false, // obligatoire pour Render
    },
  });
} else {
  // 🔹 Connexion locale ou distante via DB_HOST
  const isRemote = process.env.DB_HOST && process.env.DB_HOST.includes('render.com');

  pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT),
    ssl: isRemote ? { rejectUnauthorized: false } : false,
  });
}

// 🔍 Log config utilisée
console.log("🎯 Config PostgreSQL utilisée :", {
  connection: process.env.DATABASE_URL ? "Render/Prod" : "Local",
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  ssl: pool.options.ssl ? true : false,
});

// Export du pool pour l'utiliser dans tes controllers
module.exports = pool;
