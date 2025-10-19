// src/controllers/auth.controller.js
const User = require('../models/User');
const { generateJWT, generateRememberToken } = require('../utils/generateToken');
const bcrypt = require('bcryptjs');
const pool = require('../models/db');
// const mail = require('../config/mail');
const sendResetEmail = require('../config/mail'); // adapte le chemin si besoin
const jwt = require('jsonwebtoken');




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

/* ------------------------------------------------------------------
   REGISTER – création d’utilisateur (réservée aux admins)
-------------------------------------------------------------------*/
const register = async (req, res) => {
  try {
    const { email, password, first_name, last_name, role } = req.body;

    const roleNormalized = normalizeRole(role);
    if (!ROLES_AUTORISES.includes(roleNormalized)) {
      console.error(`[ERREUR REGISTER] Rôle inconnu : ${role} - Accès refusé.`);
      return res.status(400).json({ success: false, message: "Rôle inconnu. Accès refusé." });
    }

    // Crée l'utilisateur avec le mot de passe en clair (le hash sera fait dans le modèle)
    const user = await User.create({
      email,
      password,
      role,
      first_name,
      last_name
    });

    console.log(`[INFO REGISTER] Nouvel utilisateur créé : ${email} avec rôle ${role}`);
    res.status(201).json({ success: true, user });
  } catch (err) {
    console.error('Erreur REGISTER :', err);
    res.status(400).json({ success: false, message: err.message });
  }
};

/* ------------------------------------------------------------------
   LOGIN
-------------------------------------------------------------------*/
const login = async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;

    // 1. Chercher l’utilisateur
    const user = await User.findByEmail(email);
    if (!user) {
      console.error(`[ERREUR LOGIN] Email introuvable : ${email}`);
      return res.status(401).json({ success: false, message: 'Email ou mot de passe incorrect' });
    }

    // 2. Vérifier le mot de passe
    const isMatch = await User.comparePassword(password, user.password);
    if (!isMatch) {
      console.error(`[ERREUR LOGIN] Mot de passe incorrect pour ${email}`);
      return res.status(401).json({ success: false, message: 'Mot de passe incorrect' });
    }

    // Vérifier le rôle côté backend
    const roleNormalized = normalizeRole(user.role);
    if (!ROLES_AUTORISES.includes(roleNormalized)) {
      console.error(`[ERREUR LOGIN] Rôle inconnu pour ${email} : ${user.role}`);
      return res.status(403).json({ success: false, message: "Rôle inconnu. Accès refusé." });
    }

    // 3. Générer le JWT
    const token = generateJWT(user.id);

    // 4. Mettre à jour last_login
    await User.updateLastLogin(user.id);

    // 5. Option "se souvenir de moi"
    if (rememberMe) {
      const rememberToken = generateRememberToken();
      await User.updateRememberToken(user.id, rememberToken);

      res.cookie('remember_token', rememberToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 j
      });
    }

    // 6. Cookie JWT httpOnly
    const jwtDays = parseInt(process.env.JWT_COOKIE_EXPIRES_IN, 10) || 7;
    res.cookie('jwt', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: jwtDays * 24 * 60 * 60 * 1000,
      sameSite: 'none' // obligatoire pour cross-site requests
    });
    
    // 7. Réponse
    console.log(`[INFO LOGIN] Connexion réussie : ${email}`);
    res.json({
      success: true,
      message: 'Connexion réussie',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Erreur LOGIN :', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

/* ------------------------------------------------------------------
   LOGOUT
-------------------------------------------------------------------*/
const logout = async (_req, res) => {
  res.clearCookie('jwt');
  res.clearCookie('remember_token');
  res.json({ success: true, message: 'Déconnexion réussie' });
};

/* ------------------------------------------------------------------
   CHECK AUTH  (req.user est injecté par le middleware authenticate)
-------------------------------------------------------------------*/
const checkAuth = async (req, _res, next) => {
  try {
    return _res.json({ success: true, user: req.user });
  } catch (err) {
    next(err);
  }
};

/* ------------------------------------------------------------------
   FORGOT PASSWORD (placeholder)
-------------------------------------------------------------------*/
// 🔹 Étape 1 : Envoi du lien de réinitialisation
/* ------------------------------------------------------------------
   FORGOT PASSWORD
-------------------------------------------------------------------*/

// Étape 1 : envoyer un lien de réinitialisation
const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Aucun compte trouvé pour cet e-mail.' });
    }

    const user = result.rows[0];

    // Générer un token JWT (10 minutes)
    const token = jwt.sign({ id: user.id, email }, process.env.JWT_SECRET, { expiresIn: '10m' });

    // Stocker le token et sa date d'expiration dans la DB
    await pool.query(
      `UPDATE users
       SET reset_token = $1,
           reset_token_expires = NOW() + INTERVAL '10 minutes'
       WHERE id = $2`,
      [token, user.id]
    );

    // Envoyer le mail
    await sendResetEmail(email, token);

    res.json({ message: 'Un lien de réinitialisation a été envoyé à votre adresse e-mail.' });
  } catch (err) {
    console.error('❌ Erreur forgotPassword :', err);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
};

// Étape 2 : réinitialiser le mot de passe
const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ message: 'Token et nouveau mot de passe requis.' });
  }

  try {
    // Vérifier que le token correspond et n’est pas expiré
    const result = await pool.query(
      `SELECT * FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Lien invalide ou expiré.' });
    }

    const user = result.rows[0];

    // Hasher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Mettre à jour le mot de passe et supprimer le token
    await pool.query(
      `UPDATE users
       SET password = $1, reset_token = NULL, reset_token_expires = NULL
       WHERE id = $2`,
      [hashedPassword, user.id]
    );

    res.json({ message: 'Mot de passe réinitialisé avec succès.' });
  } catch (err) {
    console.error('❌ Erreur resetPassword :', err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
};




module.exports = { register, login, logout, checkAuth, forgotPassword , resetPassword};
