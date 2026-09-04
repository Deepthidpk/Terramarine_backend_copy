const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { authMiddleware, requireRole } = require('../middleware/auth');

// Protect all routes with authMiddleware
router.use(authMiddleware);

// Categories
router.get('/categories', categoryController.getCategories);
router.post('/categories', requireRole(['Authority', 'Admin']), categoryController.addCategory);
router.delete('/categories/:id', requireRole(['Authority', 'Admin']), categoryController.deleteCategory);

// Waste Types
router.get('/waste-types', categoryController.getWasteTypes);
router.post('/waste-types', requireRole(['Authority', 'Admin']), categoryController.addWasteType);
router.delete('/waste-types/:id', requireRole(['Authority', 'Admin']), categoryController.deleteWasteType);

module.exports = router;
