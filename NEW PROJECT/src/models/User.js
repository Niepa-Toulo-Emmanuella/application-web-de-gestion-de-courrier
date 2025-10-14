const pool = require('../config/db');
const bcrypt = require('bcryptjs');

class User {
  static async findByEmail(email) {
    try {
      const result = await pool.query(
        'SELECT * FROM users WHERE email = $1 AND is_active = true',
        [email]
      );
      return result.rows[0];
    } catch (error) {
      throw new Error('Erreur lors de la recherche utilisateur: ' + error.message);
    }
  }

  static async findById(id) {
    try {
      const result = await pool.query(
        'SELECT id, email, created_at, last_login FROM users WHERE id = $1 AND is_active = true',
        [id]
      );
      return result.rows[0];
    } catch (error) {
      throw new Error('Erreur lors de la recherche utilisateur: ' + error.message);
    }
  }

  static async create(email, password) {
    try {
      const hashedPassword = await bcrypt.hash(password, 12);
      const result = await pool.query(
        'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email, created_at',
        [email, hashedPassword]
      );
      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') {
        throw new Error('Cet email est déjà utilisé');
      }
      throw new Error('Erreur lors de la création utilisateur: ' + error.message);
    }
  }

  static async updateLastLogin(id) {
    try {
      await pool.query(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
        [id]
      );
    } catch (error) {
      console.error('Erreur mise à jour last_login:', error);
    }
  }

  static async updateRememberToken(id, token) {
    try {
      await pool.query(
        'UPDATE users SET remember_token = $1 WHERE id = $2',
        [token, id]
      );
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

  static async comparePassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }
}

module.exports = User;