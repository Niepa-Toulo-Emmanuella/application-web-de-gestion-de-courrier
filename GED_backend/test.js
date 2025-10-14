const bcrypt = require('bcryptjs');

async function generateHash(password) {
  const hash = await bcrypt.hash(password, 12);
  console.log(`Hash de "${password}" : ${hash}`);
}

generateHash('admin123'); // change ce mot de passe comme tu veux
