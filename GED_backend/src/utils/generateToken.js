const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const generateJWT = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
};

const generateRememberToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

const verifyJWT = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

module.exports = {
  generateJWT,
  generateRememberToken,
  verifyJWT
};


// const jwt = require('jsonwebtoken');
// const crypto = require('crypto');

// const generateJWT = (userId) => {
//   try {
//     const payload = {
//       userId: userId,
//       iat: Math.floor(Date.now() / 1000)
//     };

//     const secret = process.env.JWT_SECRET || 'default-secret-key-for-development';
//     const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

//     return jwt.sign(payload, secret, { expiresIn });
//   } catch (error) {
//     console.error('Erreur génération JWT:', error);
//     throw new Error('Impossible de générer le token JWT');
//   }
// };

// const verifyJWT = (token) => {
//   try {
//     const secret = process.env.JWT_SECRET || 'default-secret-key-for-development';
//     return jwt.verify(token, secret);
//   } catch (error) {
//     console.error('Erreur vérification JWT:', error);
//     throw new Error('Token JWT invalide');
//   }
// };

// const generateRememberToken = () => {
//   try {
//     return crypto.randomBytes(32).toString('hex');
//   } catch (error) {
//     console.error('Erreur génération remember token:', error);
//     throw new Error('Impossible de générer le remember token');
//   }
// };

// module.exports = {
//   generateJWT,
//   verifyJWT,
//   generateRememberToken
// };