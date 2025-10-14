// // const bcrypt = require("bcryptjs");
// // const jwt = require("jsonwebtoken");
// // const { createUser, findUserByEmail } = require("../models/user.model");
// // const ROLES = require("../models/roles");

// // // ✅ Fonction pour normaliser le rôle
// // function normalizeRole(rawRole) {
// //   rawRole = rawRole.toLowerCase();

// //   if (rawRole.includes('agent')) return ROLES.AGENT;
// //   if (rawRole.includes('directeur de cabinet adjoint')) return ROLES.DIRECTEUR_CABINET_ADJOINT;
// //   if (rawRole.includes('directeur de cabinet')) return ROLES.DIRECTEUR_CABINET;
// //   if (rawRole.includes('chef de cabinet')) return ROLES.CHEF_CABINET;
// //   if (rawRole.includes('igsjp')) return ROLES.IGSJP;
// //   if (rawRole.includes('chef de secretariat')) return ROLES.CHEF_SECRETARIAT_PARTICULIER;
// //   if (rawRole.includes("chargé d'etude") || rawRole.includes("chargé d’étude")) return ROLES.CHARGE_DETUDE;
// //   if (rawRole.includes('conseiller technique')) return ROLES.CONSEILLER_TECHNIQUE;
// //   if (rawRole.includes('directeurs')) return ROLES.LES_DIRECTEURS;
// //   if (rawRole.includes('admin')) return ROLES.ADMIN;

// //   return rawRole; // défaut
// // }

// // // ✅ Enregistrement d'un nouvel utilisateur
// // exports.register = async (req, res) => {
// //   try {
// //     const { name, email, password, role } = req.body;

// //     if (!name || !email || !password || !role) {
// //       return res.status(400).json({ message: "Tous les champs sont requis" });
// //     }

// //     if (!Object.values(ROLES).includes(role)) {
// //       return res.status(400).json({ message: "Rôle invalide" });
// //     }

// //     const existing = await findUserByEmail(email);
// //     if (existing) {
// //       return res.status(400).json({ message: "Email déjà utilisé" });
// //     }

// //     const hashedPassword = await bcrypt.hash(password, 10);

// //     const user = await createUser({
// //       name,
// //       email,
// //       password: hashedPassword,
// //       role,
// //     });

// //     const { password: _, ...userWithoutPassword } = user;

// //     res.status(201).json({ message: "Utilisateur créé", user: userWithoutPassword });
// //   } catch (err) {
// //     console.error("Erreur lors de l'inscription :", err);
// //     res.status(500).json({ message: "Erreur serveur : " + err.message });
// //   }
// // };

// // // ✅ Connexion d'un utilisateur
// // exports.login = async (req, res) => {
// //   try {
// //     const { email, password } = req.body;

// //     if (!email || !password) {
// //       return res.status(400).json({ message: "Email et mot de passe requis" });
// //     }

// //     const user = await findUserByEmail(email);
// //     if (!user) {
// //       return res.status(400).json({ message: "Utilisateur non trouvé" });
// //     }

// //     const isMatch = await bcrypt.compare(password, user.password);
// //     if (!isMatch) {
// //       return res.status(400).json({ message: "Mot de passe incorrect" });
// //     }

// //     const fixedRole = normalizeRole(user.role);

// //     const token = jwt.sign(
// //       {
// //         id: user.id,
// //         email: user.email,
// //         role: fixedRole,
// //       },
// //       process.env.JWT_SECRET,
// //       { expiresIn: "1d" }
// //     );

// //     const { password: _, ...userWithoutPassword } = user;

// //     res.json({
// //       message: "Connexion réussie",
// //       token,
// //       user: {
// //         ...userWithoutPassword,
// //         role: fixedRole, // rôle normalisé côté front aussi
// //       },
// //     });
// //   } catch (err) {
// //     console.error("Erreur lors de la connexion :", err);
// //     res.status(500).json({ message: "Erreur serveur : " + err.message });
// //   }
// // };

// // // ✅ Récupérer les infos de l'utilisateur connecté (via middleware d'auth)
// // exports.getMe = async (req, res) => {
// //   res.json(req.user);
// // };


// const User = require('../models/User');
// const { generateJWT, generateRememberToken } = require('../utils/generateToken');

// /* ---------- register (admin) ---------- */                      // ADD
// const register = async (req, res) => {
//   try {
//     const { email, password, first_name, last_name, role } = req.body;
//     const newUser = await User.create({ email, password, role, first_name, last_name });
//     res.status(201).json({ success: true, user: newUser });
//   } catch (err) {
//     res.status(400).json({ success: false, message: err.message });
//   }
// };

// /* ---------- login / logout / me (inchangés) ---------- */

// const login = async (req, res) => {
//   try {
//     const { email, password, rememberMe } = req.body;

//     // Vérifier si l'utilisateur existe
//     const user = await User.findByEmail(email);
//     console.log("Utilisateur trouvé :", user);
//     if (!user) {
//       return res.status(401).json({
//         success: false,
//         message: 'Email ou mot de passe incorrect'
//       });
//     }

//     // Vérifier le mot de passe
//     const isPasswordValid = await User.comparePassword(password, user.password);
//     if (!isPasswordValid) {
//       return res.status(401).json({
//         success: false,
//         message: 'Email correct'
//       });
//     }

//     // Générer JWT
//     const token = generateJWT(user.id);
    
//     // Mettre à jour la dernière connexion
//     await User.updateLastLogin(user.id);

//     // Gérer "Se souvenir de moi"
//     if (rememberMe) {
//       const rememberToken = generateRememberToken();
//       await User.updateRememberToken(user.id, rememberToken);
      
//       // Cookie de longue durée pour "se souvenir"
//       res.cookie('remember_token', rememberToken, {
//         httpOnly: true,
//         secure: process.env.NODE_ENV === 'production',
//         maxAge: 30 * 24 * 60 * 60 * 1000 // 30 jours
//       });
//     }

//     // Cookie JWT
//     const jwtExpiresInDays = parseInt(process.env.JWT_COOKIE_EXPIRES_IN, 10) || 7;

//     res.cookie('jwt', token, {
//     httpOnly: true,
//     secure: process.env.NODE_ENV === 'production',
//     maxAge: jwtExpiresInDays * 24 * 60 * 60 * 1000
//     });

    

//     res.json({
//       success: true,
//       message: 'Connexion réussie',
//       user: {
//         id: user.id,
//         email: user.email
//       }
//     });

//   } catch (error) {
//     console.error('Erreur login:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Erreur serveur'
//     });
//   }
// };

// const logout = async (req, res) => {
//   try {
//     // Nettoyer les cookies
//     res.clearCookie('jwt');
//     res.clearCookie('remember_token');
    
//     res.json({
//       success: true,
//       message: 'Déconnexion réussie'
//     });
//   } catch (error) {
//     console.error('Erreur logout:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Erreur serveur'
//     });
//   }
// };

// const checkAuth = async (req, res) => {
//   try {
//     res.json({
//       success: true,
//       user: {
//         id: req.user.id,
//         email: req.user.email
//       }
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: 'Erreur serveur'
//     });
//   }
// };

// const forgotPassword = async (req, res) => {
//   // À implémenter selon vos besoins
//   res.json({
//     success: true,
//     message: 'Instructions envoyées par email'
//   });
// };

// module.exports = {
//   login,
//   logout,
//   checkAuth,
//   forgotPassword,
//   register
// };

// src/controllers/auth.controller.js
const User = require('../models/User');
const { generateJWT, generateRememberToken } = require('../utils/generateToken');
const bcrypt = require('bcryptjs');

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
      maxAge: jwtDays * 24 * 60 * 60 * 1000
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
const forgotPassword = async (_req, res) => {
  res.status(501).json({ success: false, message: 'Fonction non encore implémentée' });
};

module.exports = { register, login, logout, checkAuth, forgotPassword };
