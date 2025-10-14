// ------------------------------------------------------------------
//  Modèle Imputation  – table bordereaux_imputation
// ------------------------------------------------------------------
const pool = require('../config/database');

class Imputation {
  /* -------------------------------------------------------- */
  static async create(data) {
    const {
      bordereau_id,
      premiere_transmission,
      imputations,
      instructions,
      date_depart,
      duree_traitement,
      date_retour,
      traitement_actions,
      observations,
      created_by    // ← id de l’utilisateur (req.user.id)
    } = data;

    const { rows } = await pool.query(
      `INSERT INTO bordereaux_imputation
         (bordereau_id, premiere_transmission, imputations, instructions,
          date_depart, duree_traitement, date_retour,
          traitement_actions, observations, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        bordereau_id,
        JSON.stringify(premiere_transmission || []),
        JSON.stringify(imputations || []),
        JSON.stringify(instructions || []),
        date_depart || null,
        duree_traitement || null,
        date_retour || null,
        JSON.stringify(traitement_actions || []),
        observations || null,
        created_by
      ]
    );
    return rows[0];
  }

  /* -------------------------------------------------------- */
  static async findById(id) {
    const { rows } = await pool.query(
      'SELECT * FROM bordereaux_imputation WHERE id = $1',
      [id]
    );
    return rows[0];
  }

  /* – toutes les imputations d’un bordereau ----------------- */
  static async findByBordereau(bordereau_id) {
    const { rows } = await pool.query(
      `SELECT * FROM bordereaux_imputation
       WHERE bordereau_id = $1
       ORDER BY created_at DESC`,
      [bordereau_id]
    );
    return rows;
  }
}

module.exports = Imputation;
