// const express = require('express');
// const rateLimit = require('express-rate-limit');
// const { validateLogin, handleValidationErrors } = require('../middleware/validation');
// const { authenticate } = require('../middleware/auth');
// const authController = require('../controllers/authController');

// const router = express.Router();

// // Rate limiting pour les tentatives de connexion
// const loginLimiter = rateLimit({
//   windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) * 60 * 1000,
//   max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS),
//   message: {
//     success: false,
//     message: 'Trop de tentatives de connexion, réessayez plus tard'
//   },
//   standardHeaders: true,
//   legacyHeaders: false,
// });

// // Routes publiques
// router.post('/login', loginLimiter, validateLogin, handleValidationErrors, authController.login);
// router.post('/forgot-password', authController.forgotPassword);

// // Routes protégées
// router.post('/logout', authenticate, authController.logout);
// router.get('/me', authenticate, authController.checkAuth);

// module.exports = router;

const express = require('express');
const router = express.Router();

router.post('/login', (req, res) => {
  // Juste un test simple : on renvoie un token bidon à chaque fois
  res.json({
    success: true,
    token: 'fake-jwt-token-123'
  });
});

module.exports = router;
