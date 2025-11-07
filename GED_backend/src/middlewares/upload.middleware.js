// upload.middlewares.js

const multer = require('multer');

// Stockage temporaire en mémoire pour ensuite l'envoyer sur B2
const storage = multer.memoryStorage();

const upload = multer({ storage });

module.exports = upload;
