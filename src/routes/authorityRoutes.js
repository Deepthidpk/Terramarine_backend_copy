const express = require('express');
const router = express.Router();
const authorityController = require('../controllers/authorityController');
const { authMiddleware, requireRole } = require('../middleware/auth');

// Protect all routes with Municipal Authority role check
router.use(authMiddleware);
router.use(requireRole(['Authority', 'Admin']));

router.get('/users', authorityController.getDistrictUsers);
router.put('/users/:id/status', authorityController.updateDistrictUserStatus);
router.post('/workers', authorityController.addWorker);

module.exports = router;
