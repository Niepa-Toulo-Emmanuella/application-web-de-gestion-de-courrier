// src/controllers/envoyer.controller.js
const pool = require('../config/database'); // adapte si tu utilises un autre nom
const { envoyer } = require('./bordereau.controller');

const getEnvoisPourDestinataire = async (req, res) => {
  const userId = req.user.id;
  try {
    const result = await pool.query(
        `SELECT e.*, c.objet, b.numero_reference, b.numero
        FROM envois e
        LEFT JOIN courriers c ON e.courrier_id = c.id
        LEFT JOIN bordereaux b ON e.bordereau_id = b.id
        WHERE e.destinataire_id = $1
        ORDER BY e.date_envoi DESC`,
    [userId]
    );

    res.status(200).json({ success: true, envois: result.rows });
  } catch (error) {
    console.error("Erreur envois chef:", error);
    res.status(500).json({ success: false, message: "Erreur serveur." });
  }
};

module.exports = { getEnvoisPourDestinataire,envoyer };
