const { verifyJWT } = require('../utils/generateToken');
const User = require('../models/User');

const authenticate = async (req, res, next) => {
  try {
    const token = req.cookies.jwt || req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token d\'authentification requis' 
      });
    }

    const decoded = verifyJWT(token);
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Utilisateur non trouvé' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ 
      success: false, 
      message: 'Token invalide' 
    });
  }
};

module.exports = { authenticate };