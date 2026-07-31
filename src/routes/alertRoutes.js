const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.post('/', authMiddleware, requireRole(['Authority', 'Admin']), alertController.createAlert);
router.get('/', authMiddleware, alertController.getAlerts);

module.exports = router;
