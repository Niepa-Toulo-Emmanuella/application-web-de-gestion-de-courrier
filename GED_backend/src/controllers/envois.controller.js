
//envois.controller.js 
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
    // 📨 Récupération de la priorité du courrier concerné
    const courrierRes = await pool.query(
      `SELECT priorite FROM courriers WHERE id = $1`,
      [courrier_id]
    );
    const priorite = courrierRes.rows[0]?.priorite || 'Normale';


    const result = await pool.query(
      `INSERT INTO envois 
       (courrier_id, bordereau_id, expediteur_id, destinataire_id, statut, date_envoi, priorite)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [courrier_id, bordereau_id, expediteur_id, destinataire_id, statut, date_envoi, priorite]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("Erreur transmission :", err);
    res.status(500).json({ success: false, message: "Erreur de transmission" });
  }
};
