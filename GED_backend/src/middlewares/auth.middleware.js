// const jwt = require("jsonwebtoken");

// // Middleware d'authentification avec contrôle optionnel des rôles
// // roles : tableau de rôles autorisés (ex: ['agent'])
// module.exports = (roles = []) => {
//   return (req, res, next) => {
//     const authHeader = req.headers.authorization;

//     if (!authHeader || !authHeader.startsWith("Bearer ")) {
//       return res.status(401).json({ message: "Token manquant ou invalide" });
//     }

//     const token = authHeader.split(" ")[1];

//     try {
//       // Vérifie et décode le token
//       const decoded = jwt.verify(token, process.env.JWT_SECRET);

//       // On vérifie que le token contient bien un id utilisateur
//       if (!decoded.id) {
//         return res.status(400).json({ message: "Token JWT invalide : id utilisateur manquant" });
//       }

//       // Stocke uniquement les infos utiles dans req.user
//       req.user = {
//         id: decoded.id,
//         nom: decoded.nom || null,
//         role: decoded.role || null,
//       };

//       // Si on a spécifié des rôles autorisés, on vérifie que l'utilisateur a bien un rôle autorisé
//       if (roles.length > 0 && !roles.includes(req.user.role)) {
//         return res.status(403).json({ message: "Accès refusé : rôle non autorisé" });
//       }

//       // Tout est ok, on passe au middleware suivant / route
//       next();

//     } catch (err) {
//       console.error("Erreur lors de la vérification du token JWT :", err);
//       return res.status(401).json({ message: "Token invalide ou expiré" });
//     }
//   };
// };
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware générique : vérifie et décode le token
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ message: 'Aucun token fourni.' });

  const token = authHeader.split(' ')[1]; // format: "Bearer TOKEN"
  if (!token) return res.status(401).json({ message: 'Token manquant.' });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Token invalide.' });
    req.user = decoded; // on stocke les infos utilisateur dans req.user
    next();
  });
};

// Middleware d’authentification complet avec vérification de l’utilisateur en BDD
const authenticate = async (req, res, next) => {
  try {
    const token = req.cookies.jwt || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ success: false, message: 'Token d\'authentification requis' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
     // 🟢 Ajoute ce log ici
    console.log("🔑 Token décodé :", decoded);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Utilisateur non trouvé' });
    }

    // Log pour debug
    console.log('Rôle récupéré depuis la BDD :', `"${user.role}"`);

    
    req.user = user; // stocke l’utilisateur complet (pas juste son ID)
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Token invalide' });
  }
};

// Middleware pour vérifier que l'utilisateur est un admin
const isAdmin = (req, res, next) => {
  console.log('Vérification rôle pour isAdmin :', `"${req.user.role}"`);
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Accès refusé (admin uniquement)' });
  }
  console.log("🔑 req.user middleware:", req.user);

  next();
};


module.exports = {
  verifyToken,
  authenticate,
  isAdmin
};
