// src/models/Courrier.js
const pool = require('./db');

class Courrier {
  /* ------------------------------ SELECT ---------------------------- */
  static async findAll() {
    const { rows } = await pool.query('SELECT * FROM courriers ORDER BY created_at DESC');
    return rows;
  }

  static async findById(id) {
    const { rows } = await pool.query('SELECT * FROM courriers WHERE id = $1', [id]);
    return rows[0];
  }

  /* ------------------------------ INSERT --------------------------- */
  static async create(data) {
    const {
      reference,
      objet,
      expediteur,
      destinataire,
      date_reception,
      date_arrivee,
      numero_enregistrement,
      heure,
      fichier_scan
    } = data;

    const { rows } = await pool.query(
      `INSERT INTO courriers
       (reference, objet, expediteur, destinataire,
        date_reception, date_arrivee, numero_enregistrement, heure, fichier_scan)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        reference,
        objet,
        expediteur,
        destinataire,
        date_reception,
        date_arrivee,
        numero_enregistrement,
        heure,
        fichier_scan
      ]
    );
    return rows[0];
  }

  /* ------------------------------ UPDATE --------------------------- */
  static async update(id, data) {
    const {
      reference,
      objet,
      expediteur,
      destinataire,
      date_reception,
      date_arrivee,
      numero_enregistrement,
      heure,
      fichier_scan
    } = data;

    const { rows } = await pool.query(
      `UPDATE courriers SET
         reference            = COALESCE($2, reference),
         objet                = COALESCE($3, objet),
         expediteur           = COALESCE($4, expediteur),
         destinataire         = COALESCE($5, destinataire),
         date_reception       = COALESCE($6, date_reception),
         date_arrivee         = COALESCE($7, date_arrivee),
         numero_enregistrement= COALESCE($8, numero_enregistrement),
         heure                = COALESCE($9, heure),
         fichier_scan         = COALESCE($10, fichier_scan)
       WHERE id = $1
       RETURNING *`,
      [
        id,
        reference,
        objet,
        expediteur,
        destinataire,
        date_reception,
        date_arrivee,
        numero_enregistrement,
        heure,
        fichier_scan
      ]
    );
    return rows[0];
  }

  /* ------------------------------ DELETE --------------------------- */
  static async remove(id) {
    await pool.query('DELETE FROM courriers WHERE id = $1', [id]);
  }
}

module.exports = Courrier;
