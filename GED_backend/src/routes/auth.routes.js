// const express = require('express');
// const rateLimit = require('express-rate-limit');
// const { validateLogin, handleValidationErrors } = require('../middlewares/validation');
// const { authenticate } = require('../middlewares/auth.middleware');
// const authcontroller = require('../controllers/auth.controller');

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
// router.post('/login', loginLimiter, validateLogin, handleValidationErrors, authcontroller.login);
// router.post('/forgot-password', authcontroller.forgotPassword);

// // Routes protégées
// router.post('/logout', authenticate, authcontroller.logout);
// router.get('/me', authenticate, authcontroller.checkAuth);

// module.exports = router

const express = require('express');
const rateLimit = require('express-rate-limit');
const { validateLogin, validateRegister, handleValidationErrors } = require('../middlewares/validation');
const { authenticate, isAdmin } = require('../middlewares/auth.middleware');    // ADD
const ctrl = require('../controllers/auth.controller');

const router = express.Router();

/* ----  Limiteur login  ---- */
const loginLimiter = rateLimit({
  windowMs: +process.env.RATE_LIMIT_WINDOW * 60 * 1000,
  max: +process.env.RATE_LIMIT_MAX_REQUESTS
});

/* ----  Routes publiques  ---- */
router.post('/login', loginLimiter, validateLogin, handleValidationErrors, ctrl.login);

/* ----  Route création utilisateur (admin)  ---- */              // ADD
router.post(
  '/register',
  authenticate,
  isAdmin,
  validateRegister,
  handleValidationErrors,
  ctrl.register
);

/* ----  Routes protégées  ---- */
router.post('/logout', authenticate, ctrl.logout);
router.get('/me', authenticate, ctrl.checkAuth);

router.post('/forgot-password', ctrl.forgotPassword);
router.get('/verify', authenticate, ctrl.checkAuth); // Pour correspondre au frontend
router.post("/reset-password", ctrl.resetPassword);



module.exports = router;
