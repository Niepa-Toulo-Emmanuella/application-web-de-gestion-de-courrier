// routes/signature.routes.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const controller = require('../controllers/signature.controller');

router.post('/request-otp', authenticate, controller.requestOtp);
router.post('/verify-otp', authenticate, controller.verifyOtp);

module.exports = router;
