// controllers/user.controller.js
const bcrypt = require('bcrypt');
const pool = require('../models/db');

// Liste des rôles autorisés (normalisés)
const ROLES_AUTORISES = [
  'admin',
  'agent',
  'directeur de cabinet',
  'directeur de cabinet adjoint',
  'igsjp',
  'chef de cabinet',
  'conseiller technique',
  'chef de secretariat particulier',
  "charge d'etude",
  'les directeurs'
];

// Fonction utilitaire pour normaliser les rôles
function normalizeRole(role) {
  return role
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// -------------------- GET ALL USERS --------------------
exports.getAll = async (req, res) => {
  try {
    const role = req.query.role;
    let query = 'SELECT id, first_name, last_name, email, role, is_active, last_login FROM users';
    const params = [];

    if (role) {
      query += ' WHERE role = $1';
      params.push(role);
    }

    const { rows } = await pool.query(query, params);
    res.json({ success: true, data: rows });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// -------------------- TOGGLE ACTIVE --------------------
exports.toggleActive = async (req, res) => {
  const userId = req.params.id;
  const { is_active } = req.body;

  try {
    await pool.query('UPDATE users SET is_active = $1 WHERE id = $2', [is_active, userId]);
    res.json({ success: true, message: 'Statut mis à jour' });
  } catch (err) {
    console.error('Erreur activation:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// -------------------- CREATE USER --------------------
exports.create = async (req, res) => {
  console.log("💡 Requête reçue:", req.body); // <--- ajout ici
  const { email, password, role, first_name, last_name } = req.body;

  if (!email || !password || !role) {
    return res.status(400).json({ success: false, message: "Champs obligatoires manquants" });
  }

  const roleNormalized = normalizeRole(role);
  if (!ROLES_AUTORISES.includes(roleNormalized)) {
    console.error(`[ERREUR] Rôle inconnu : ${role} - Accès refusé.`);
    return res.status(400).json({ success: false, message: "Rôle inconnu. Accès refusé." });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users (email, password, role, first_name, last_name)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, role, created_at`,
      [email, hashedPassword, roleNormalized, first_name, last_name]
    );

    console.log(`[INFO] Nouvel utilisateur créé : ${email} avec rôle ${role}`);
    res.status(201).json({ success: true, data: result.rows[0] });

  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, message: "Email déjà utilisé" });
    }

    console.error('Erreur création utilisateur:', err);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
};

// -------------------- UPDATE USER --------------------
exports.updateUser = async (req, res) => {
  const id = parseInt(req.params.id);

  console.log('Update user id:', id);
  console.log('Body:', req.body);

  if (isNaN(id)) {
    return res.status(400).json({ success: false, message: "ID utilisateur invalide" });
  }

  const { first_name, last_name, role, password } = req.body;

  const roleNormalized = normalizeRole(role);
  if (!ROLES_AUTORISES.includes(roleNormalized)) {
    console.error(`[ERREUR] Rôle inconnu : ${role} - Accès refusé.`);
    return res.status(400).json({ success: false, message: "Rôle inconnu. Accès refusé." });
  }

  try {
    let query = 'UPDATE users SET first_name = $1, last_name = $2, role = $3';
    const params = [first_name, last_name, role];

    if (password) {
      const hashed = await bcrypt.hash(password, 10);
      query += ', password = $4 WHERE id = $5';
      params.push(hashed, id);
    } else {
      query += ' WHERE id = $4';
      params.push(id);
    }

    console.log('SQL:', query);
    console.log('Params:', params);

    await pool.query(query, params);
    console.log(`[INFO] Utilisateur mis à jour : ${id} avec rôle ${role}`);
    res.json({ success: true, message: "Utilisateur mis à jour" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
};

// -------------------- GET USER BY ID --------------------
exports.getUserById = async (req, res) => {
  const id = parseInt(req.params.id);

  if (isNaN(id)) {
    return res.status(400).json({ success: false, message: "ID utilisateur invalide" });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Utilisateur non trouvé" });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
};

// -------------------- DELETE USER --------------------
exports.deleteUser = async (req, res) => {
  const id = req.params.id;

  try {
    const result = await pool.query('DELETE FROM users WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).send('Utilisateur non trouvé.');
    }

    console.log(`[INFO] Utilisateur supprimé : ${id}`);
    res.status(200).send('Utilisateur supprimé avec succès.');
  } catch (err) {
    console.error('Erreur suppression utilisateur :', err);
    res.status(500).send('Erreur serveur lors de la suppression.');
  }
};
