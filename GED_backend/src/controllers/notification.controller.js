// controllers/notification.controller.js
const db = require('../models/db');

/**
 * 📩 Récupérer toutes les notifications reçues par un destinataire
 */
exports.getReceptions = async (req, res) => {
  try {
    // 🔑 Vérifie que le JWT a bien été décodé
    console.log("🔑 req.user :", req.user);
    const destinataireId = req.user.id || req.user.userId; // récupéré via JWT middleware
    console.log("👀 ID du destinataire :", destinataireId);

    const result = await db.query(
      `SELECT 
        e.id,
        b.id AS bordereau_id,
        b.fichier_bordereau,
        c.id AS courrier_id,
        c.fichier_scan,
        b.numero,
        b.objet,
        e.date_envoi,
        u.first_name,
        u.last_name
      FROM envois e
      JOIN bordereaux b ON e.bordereau_id = b.id
      JOIN courriers c ON e.courrier_id = c.id
      JOIN users u ON e.expediteur_id = u.id
      WHERE e.destinataire_id = $1
      ORDER BY e.date_envoi DESC`,
      [destinataireId]
    );

    console.log("📬 Notifications trouvées :", result.rows);

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("❌ Erreur getReceptions :", err);
    res.status(500).json({ success: false, message: "Erreur lors de la récupération des notifications" });
  }
};

/**
 * ✅ Marquer une notification comme lue
 */
exports.marquerCommeLue = async (req, res) => {
  try {
    const { id } = req.params; // id de l’envoi
    await db.query(
      `UPDATE envois SET lu = true WHERE id = $1`,
      [id]
    );
    res.json({ success: true, message: "Notification marquée comme lue ✅" });
  } catch (err) {
    console.error("❌ Erreur marquerCommeLue :", err);
    res.status(500).json({ success: false, message: "Erreur lors de la mise à jour" });
  }
};
