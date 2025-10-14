// const { Pool } = require('pg');
// require('dotenv').config();

// const pool = new Pool({
//   connectionString: process.env.DATABASE_URL,
//   ssl: { rejectUnauthorized: false } // utile sur Render
// });

// module.exports = pool;
// const { Pool } = require("pg");

// const db = new Pool({
//   connectionString: process.env.DATABASE_URL,
//   ssl: {
//     rejectUnauthorized: false,
//   },
// });

// module.exports = db;

// Exemple : src/db.js
// const { Pool } = require('pg');

// const pool = new Pool({
//   user: 'postgres',
//   // user: 'courrier_postgresql_emma_user',
//   // host: 'dpg-d0hd9j3uibrs739khlpg-a.oregon-postgres.render.com',
//   host: 'localhost',
//   database: 'courrier',
//   password: 'PApa@2932',
//   port: 5432,
//   ssl: false
// });

// console.log("🎯 Config PostgreSQL utilisée :", {
//   user: 'postgres',
//   host: 'localhost',
//   database: 'courrier',
//   password: 'PApa@2932',
//   port: 5432,
//   ssl: false
// });


// module.exports = pool;

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT),
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

console.log("🎯 Config PostgreSQL utilisée :", {
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  ssl: process.env.DB_SSL
});

module.exports = pool;

