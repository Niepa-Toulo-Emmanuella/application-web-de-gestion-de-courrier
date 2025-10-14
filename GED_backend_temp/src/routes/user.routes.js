// // routes/user.routes.js
// const express = require('express');
// const router = express.Router();
// const userController = require('../controllers/user.Controller');

// // GET /api/users or /api/users?role=chef
// // router.get('/', userController.getAll);

// // routes/user.routes.js
// router.get('/api/users', async (req, res) => {
//   try {
//     const result = await pool.query('SELECT * FROM users ORDER BY id');
//     res.json(result.rows);
//   } catch (err) {
//     res.status(500).json({ message: 'Erreur serveur' });
//   }
// });

// router.put('/users/:id/activate', userController.toggleActive);


// module.exports = router;


const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.Controller');
const { authenticate, isAdmin } = require('../middlewares/auth.middleware');

router.get('/admin', authenticate, isAdmin, (req, res) => {
  res.send('Bienvenue Admin');
});


// GET /api/users or /api/users?role=admin
router.get('/', userController.getAll);

// PUT /api/users/:id/activate
router.put('/:id/activate', userController.toggleActive);

router.post('/', userController.create);

// Obtenir un utilisateur par ID
router.get('/:id', userController.getUserById);

// Modifier un utilisateur
router.put('/:id', userController.updateUser);

// Route pour supprimer un utilisateur
router.delete('/api/users/:id', userController.deleteUser);

module.exports = router;
