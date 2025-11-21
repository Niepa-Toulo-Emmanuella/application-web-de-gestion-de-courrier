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
// router.delete('/api/users/:id', userController.deleteUser);

// DELETE /api/users/:id
router.delete('/:id', authenticate, isAdmin, userController.deleteUser);

module.exports = router;
