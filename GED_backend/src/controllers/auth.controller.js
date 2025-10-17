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
const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    // Vérifie si l'utilisateur existe
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    // Génère un token temporaire
    const resetToken = Math.random().toString(36).substring(2, 15);
    const resetTokenExpires = new Date(Date.now() + 3600000); // 1h

    // 🔹 Met à jour en base de données (tu dois avoir les colonnes correspondantes)
    await pool.query(
      `UPDATE users 
       SET reset_token = $1, reset_token_expires = $2 
       WHERE email = $3`,
      [resetToken, resetTokenExpires, email]
    );

    // 🔹 Envoi de l'email
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const resetUrl = `https://application-web-de-gestion-de-courrier-1.onrender.com/reset-password.html?token=${resetToken}`;
    console.log("🔗 resetUrl généré :", resetUrl);
    
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: email,
      subject: "Réinitialisation de mot de passe",
      text: `Cliquez sur ce lien pour réinitialiser votre mot de passe : ${resetUrl}`
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Email de réinitialisation envoyé à ${email}`);

    return res.json({ message: "Email de réinitialisation envoyé." });

  } catch (err) {
    console.error("❌ Erreur forgotPassword :", err.message);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};



module.exports = { register, login, logout, checkAuth, forgotPassword };
