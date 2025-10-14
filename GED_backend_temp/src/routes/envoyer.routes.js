const express = require("express");
const router = express.Router();

const { authenticate } = require("../middlewares/auth.middleware");
const { getEnvoisPourDestinataire } = require("../controllers/envoyer.controller");

router.get("/", authenticate, getEnvoisPourDestinataire);

module.exports = router;
