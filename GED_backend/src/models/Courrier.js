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
      annee_generation,   // ✅ AJOUTE ICI
      heure,
      fichier_scan,
      priorite
    } = data;

    const { rows } = await pool.query(
      `INSERT INTO courriers
       (reference, objet, expediteur, destinataire,
        date_reception, date_arrivee, numero_enregistrement, annee_generation, heure, fichier_scan, priorite)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        reference,
        objet,
        expediteur,
        destinataire,
        date_reception,
        date_arrivee,
        numero_enregistrement,
        annee_generation,
        heure,
        fichier_scan,
        priorite
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
      annee_generation,   // ✅ AJOUTE ICI
      heure,
      fichier_scan,
      priorite
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
         annee_generation     = COALESCE($9, annee_generation),
         heure                = COALESCE($10, heure),
         fichier_scan         = COALESCE($11, fichier_scan),
         priorite             = COALESCE($11, priorite)
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
        annee_generation,
        heure,
        fichier_scan,
        priorite
      ]
    );
    return rows[0];
  }

  /* ------------------------------ DELETE --------------------------- */
  static async remove(id) {
    await pool.query('DELETE FROM courriers WHERE id = $1', [id]);
  }

  static async findLastByDate(annee, mois, jour) {
    // On filtre les courriers créés le même jour (en se basant sur la date d'arrivée)
    const query = `
      SELECT * FROM courriers
      WHERE EXTRACT(YEAR FROM date_arrivee) = $1
        AND EXTRACT(MONTH FROM date_arrivee) = $2
        AND EXTRACT(DAY FROM date_arrivee) = $3
      ORDER BY id DESC
      LIMIT 1
    `;
    const result = await pool.query(query, [annee, mois, jour]);
    return result.rows[0] || null;
  }

  /* -------------------- Récupère le dernier courrier créé ------------------- */
  static async findLast() {
    const { rows } = await pool.query(`
      SELECT numero_enregistrement, annee_generation
      FROM courriers
      ORDER BY id DESC
      LIMIT 1
    `);
    return rows[0] || null;
  }

}



module.exports = Courrier;
