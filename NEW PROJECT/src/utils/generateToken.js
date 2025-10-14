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