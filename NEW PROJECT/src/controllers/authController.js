const User = require('../models/User');
const { generateJWT, generateRememberToken } = require('../utils/generateToken');

const login = async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;

    // Vérifier si l'utilisateur existe
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }

    // Vérifier le mot de passe
    const isPasswordValid = await User.comparePassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }

    // Générer JWT
    const token = generateJWT(user.id);
    
    // Mettre à jour la dernière connexion
    await User.updateLastLogin(user.id);

    // Gérer "Se souvenir de moi"
    if (rememberMe) {
      const rememberToken = generateRememberToken();
      await User.updateRememberToken(user.id, rememberToken);
      
      // Cookie de longue durée pour "se souvenir"
      res.cookie('remember_token', rememberToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 jours
      });
    }

    // Cookie JWT
    res.cookie('jwt', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: parseInt(process.env.JWT_COOKIE_EXPIRES_IN) * 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      message: 'Connexion réussie',
      user: {
        id: user.id,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Erreur login:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

const logout = async (req, res) => {
  try {
    // Nettoyer les cookies
    res.clearCookie('jwt');
    res.clearCookie('remember_token');
    
    res.json({
      success: true,
      message: 'Déconnexion réussie'
    });
  } catch (error) {
    console.error('Erreur logout:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

const checkAuth = async (req, res) => {
  try {
    res.json({
      success: true,
      user: {
        id: req.user.id,
        email: req.user.email
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

const forgotPassword = async (req, res) => {
  // À implémenter selon vos besoins
  res.json({
    success: true,
    message: 'Instructions envoyées par email'
  });
};

module.exports = {
  login,
  logout,
  checkAuth,
  forgotPassword
};