// src/controllers/auth.controller.js
const User = require('../models/User');
const { generateJWT, generateRememberToken } = require('../utils/generateToken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer'); // ✅ Ajouter Nodemailer
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
const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    // Vérifie si l'utilisateur existe
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    // Génère un token unique
    const resetToken = Math.random().toString(36).substring(2, 15);
    const resetTokenExpires = new Date(Date.now() + 3600000); // 1 heure

    // Enregistre le token et la date d’expiration
    await pool.query(
      `UPDATE users 
       SET reset_token = $1, reset_token_expires = $2 
       WHERE email = $3`,
      [resetToken, resetTokenExpires, email]
    );

    // Config SMTP
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: { rejectUnauthorized: false },
    });

    // Lien pour réinitialiser
    const resetUrl = `https://application-web-de-gestion-de-courrier-1.onrender.com/reset-password.html?token=${resetToken}`;

    // Envoi du mail
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: email,
      subject: "Réinitialisation de votre mot de passe",
      text: `Bonjour,\n\nCliquez sur ce lien pour réinitialiser votre mot de passe : ${resetUrl}\n\nCe lien expire dans 1 heure.`,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Email envoyé à ${email}`);

    res.json({ message: "Email de réinitialisation envoyé." });

  } catch (error) {
    console.error("❌ Erreur forgotPassword :", error.message);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// 🔹 Étape 2 : Réinitialisation du mot de passe
const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    // Vérifie si le token est valide
    const result = await pool.query(
      `SELECT * FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: "Lien invalide ou expiré" });
    }

    const user = result.rows[0];

    // Hash le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Met à jour le mot de passe et supprime le token
    await pool.query(
      `UPDATE users
       SET mot_de_passe = $1, reset_token = NULL, reset_token_expires = NULL
       WHERE id = $2`,
      [hashedPassword, user.id]
    );

    res.json({ message: "Mot de passe réinitialisé avec succès." });

  } catch (error) {
    console.error("❌ Erreur resetPassword :", error.message);
    res.status(500).json({ message: "Erreur serveur" });
  }
};




module.exports = { register, login, logout, checkAuth, forgotPassword , resetPassword};
