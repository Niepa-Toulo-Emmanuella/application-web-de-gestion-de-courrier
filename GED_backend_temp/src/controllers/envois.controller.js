
exports.create = async (req, res) => {
  const {
    courrier_id,
    bordereau_id,
    expediteur_id,
    destinataire_id,
    statut,
    date_envoi
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO envois 
       (courrier_id, bordereau_id, expediteur_id, destinataire_id, statut, date_envoi)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [courrier_id, bordereau_id, expediteur_id, destinataire_id, statut, date_envoi]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("Erreur transmission :", err);
    res.status(500).json({ success: false, message: "Erreur de transmission" });
  }
};
