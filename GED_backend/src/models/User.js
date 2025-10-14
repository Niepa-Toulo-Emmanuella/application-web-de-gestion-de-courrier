const bcrypt = require('bcryptjs');
const pool = require('../models/db');

class User {
  /* ------------------------------------------------------------------
     Trouver un utilisateur par email
  ------------------------------------------------------------------*/
  static async findByEmail(email) {
    try {
      const result = await pool.query(
        'SELECT * FROM users WHERE email = $1 AND is_active = true',
        [email]
      );
      return result.rows[0]; // undefined si non trouvé
    } catch (error) {
      throw new Error('Erreur lors de la recherche utilisateur: ' + error.message);
    }
  }

  /* ------------------------------------------------------------------
     Créer un utilisateur – hash du mot de passe ici
  ------------------------------------------------------------------*/
  static async create({ email, password, role = 'agent', first_name = null, last_name = null }) {
    try {
      const hashedPassword = await bcrypt.hash(password, 12);
      const result = await pool.query(
        `INSERT INTO users (email, password, role, first_name, last_name)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email, role, created_at`,
        [email, hashedPassword, role, first_name, last_name]
      );
      return result.rows[0];
    } catch (e) {
      if (e.code === '23505') throw new Error('Email déjà utilisé');
      throw new Error('Erreur lors de la création utilisateur: ' + e.message);
    }
  }

  /* ------------------------------------------------------------------
     Trouver un utilisateur par ID
  ------------------------------------------------------------------*/
  static async findById(id) {
    try {
      const result = await pool.query(
        'SELECT id, email, role, created_at, last_login FROM users WHERE id = $1 AND is_active = true',
        [id]
      );
      return result.rows[0];
    } catch (error) {
      throw new Error('Erreur lors de la recherche utilisateur: ' + error.message);
    }
  }

  /* ------------------------------------------------------------------
     Mettre à jour last_login
  ------------------------------------------------------------------*/
  static async updateLastLogin(id) {
    try {
      await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [id]);
    } catch (error) {
      console.error('Erreur mise à jour last_login:', error);
    }
  }

  

  /* ------------------------------------------------------------------
     remember_token
  ------------------------------------------------------------------*/
  static async updateRememberToken(id, token) {
    try {
      await pool.query('UPDATE users SET remember_token = $1 WHERE id = $2', [token, id]);
    } catch (error) {
      console.error('Erreur mise à jour remember_token:', error);
    }
  }

  static async findByRememberToken(token) {
    try {
      const result = await pool.query(
        'SELECT * FROM users WHERE remember_token = $1 AND is_active = true',
        [token]
      );
      return result.rows[0];
    } catch (error) {
      throw new Error('Erreur recherche par token: ' + error.message);
    }
  }

  /* ------------------------------------------------------------------
     Comparer mot de passe saisi avec hash stocké
  ------------------------------------------------------------------*/
  static async comparePassword(plainPassword, hashedPassword) {
    try {
      return await bcrypt.compare(plainPassword, hashedPassword);
    } catch (error) {
      console.error('Erreur comparaison mot de passe:', error);
      return false;
    }
  }
}

module.exports = User;


// Modèle User temporaire simplifié


// const bcrypt = require('bcryptjs');

// class User {
//   static async findByEmail(email) {
//     // Simulation d'un utilisateur pour les tests
//     if (email === 'test@example.com') {
//       return {
//         id: 1,
//         email: 'test@example.com',
//         password: await bcrypt.hash('password123', 10), // mot de passe : "password123"
//         created_at: new Date(),
//         last_login: null
//       };
//     }
//     return null;
//   }

//   static async findById(id) {
//     // Simulation d'un utilisateur pour les tests
//     if (id === 1) {
//       return {
//         id: 1,
//         email: 'test@example.com',
//         created_at: new Date(),
//         last_login: new Date()
//       };
//     }
//     return null;
//   }

//   static async comparePassword(password, hashedPassword) {
//     try {
//       return await bcrypt.compare(password, hashedPassword);
//     } catch (error) {
//       console.error('Erreur comparaison mot de passe:', error);
//       return false;
//     }
//   }

//   static async updateLastLogin(userId) {
//     // Simulation de mise à jour
//     console.log(`Mise à jour dernière connexion pour l'utilisateur ${userId}`);
//     return true;
//   }

//   static async updateRememberToken(userId, token) {
//     // Simulation de mise à jour du token
//     console.log(`Mise à jour token remember pour l'utilisateur ${userId}`);
//     return true;
//   }
// }

// module.exports = User;