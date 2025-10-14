const { body, validationResult } = require('express-validator');

// const validateLogin = [
//   body('email')
//     .isEmail()
//     .normalizeEmail()
//     .withMessage('Email invalide'),
//   body('password')
//     .isLength({ min: 6 })
//     .withMessage('Le mot de passe doit contenir au moins 6 caractères'),
// ];

/* -------- login -------- */
const validateLogin = [
  body('email').isEmail(),
  body('password').isLength({ min: 6 })
];

/* -------- register (admin) -------- */                          // ADD
const validateRegister = [
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('first_name').optional().isString(),
  body('last_name').optional().isString(),
  body('role').optional().isIn(['agent', 'admin','chef'])
];

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Données invalides',
      errors: errors.array()
    });
  }
  next();
};

module.exports = {
  validateLogin,
  validateRegister,
  handleValidationErrors
};