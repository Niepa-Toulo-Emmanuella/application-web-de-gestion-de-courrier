// src/models/Bordereau.js
const db = require('./db');

class Bordereau {
  /* -------- SELECT TOUS LES BORDEREAUX -------------------------------- */
  static async findAll() {
    const { rows } = await db.query(
      `SELECT b.*, c.reference
       FROM bordereaux b
       JOIN courriers c ON c.id = b.courrier_id
       ORDER BY b.created_at DESC`
    );
    return rows;
  }

  /* -------- SELECT PAR ID -------------------------------------------- */
  static async findById(id) {
    const { rows } = await db.query(
      `SELECT b.*, c.*
       FROM bordereaux b
       JOIN courriers c ON c.id = b.courrier_id
       WHERE b.id = $1`,
      [id]
    );
    return rows[0];
  }

  /* -------- INSERT UN NOUVEAU BORDEREAU ------------------------------ */
  static async create(data) {
    const {
      courrier_id,
      expediteur,
      numero_reference,
      date_courrier,
      date_arrivee,
      numero_enregistrement,
      heure,
      objet,
      observations,
      statut = ''
    } = data;

    const year = new Date().getFullYear();
    const prefix = `BDR-${year}-`;

    // Récupérer le dernier numéro
    const result = await db.query(
      `SELECT numero FROM bordereaux
       WHERE numero LIKE $1
       ORDER BY id DESC LIMIT 1`,
      [`${prefix}%`]
    );

    let newNumber = '0001';
    if (result.rows.length > 0) {
      const lastNum = parseInt(result.rows[0].numero.split('-')[2], 10);
      newNumber = String(lastNum + 1).padStart(4, '0');
    }

    const numero = `${prefix}${newNumber}`;

    const { rows } = await db.query(
      `INSERT INTO bordereaux (
        courrier_id, expediteur, numero_reference,
        date_courrier, date_arrivee, numero_enregistrement,
        heure, objet, observations, statut, numero
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10'en_attente',$11)
      RETURNING *`,
      [
        courrier_id,
        expediteur,
        numero_reference,
        date_courrier,
        date_arrivee,
        numero_enregistrement,
        heure,
        objet,
        observations,
        statut,
        numero
      ]
    );
    return rows[0];
  }

  /* -------- MODIFIER UN BORDEREAU EXISTANT -------------------------- */
  static async update(id, data) {
    const {
      premiere_transmission,
      imputation,
      instructions,
      date_depart,
      duree_traitement,
      date_retour,
      observations,
      statut
    } = data;

    const { rows } = await db.query(
      `UPDATE bordereaux SET
        premiere_transmission = COALESCE($2, premiere_transmission),
        imputation            = COALESCE($3, imputation),
        instructions          = COALESCE($4, instructions),
        date_depart           = COALESCE($5, date_depart),
        duree_traitement      = COALESCE($6, duree_traitement),
        date_retour           = COALESCE($7, date_retour),
        observations          = COALESCE($8, observations)
       WHERE id = $1
       RETURNING *`,
      [
        id,
        premiere_transmission,
        imputation,
        instructions,
        date_depart,
        duree_traitement,
        date_retour,
        observations
      ]
    );
    return rows[0];
  }

  /* -------- PASSER UN BORDEREAU AU STATUT "envoye" ------------------ */
  static async markSent(id) {
    const { rows } = await db.query(
      `UPDATE bordereaux
       SET statut = 'envoye'
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    return rows[0];
  }

  /* -------- SUPPRIMER UN BORDEREAU --------------------------------- */
  static async remove(id) {
    await db.query('DELETE FROM bordereaux WHERE id = $1', [id]);
  }
}

module.exports = Bordereau;
