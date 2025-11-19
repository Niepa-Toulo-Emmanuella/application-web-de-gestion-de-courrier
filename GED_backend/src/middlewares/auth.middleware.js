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

    
    // req.user = user; // stocke l’utilisateur complet (pas juste son ID)


    // On peut directement utiliser les infos du token
    req.user = {
      id: decoded.userId,
      role: decoded.role
    };
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

const isAdminOrAgent = (req, res, next) => {
  if (req.user.role === 'agent') {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Accès refusé.' });
};

const hasRole = (allowedRoles = []) => (req, res, next) => {
  if (!req.user || !req.user.role) {
    console.log("🔑 req.user middleware:", req.user || req.user.role);
    return res.status(403).json({ success: false, message: 'Accès refusé.' });
  }

  if (allowedRoles.includes(req.user.role)) {
    return next();
  }

  return res.status(403).json({ success: false, message: 'Accès refusé.' });
};




module.exports = {
  verifyToken,
  authenticate,
  isAdmin,
  isAdminOrAgent,
  hasRole
};
