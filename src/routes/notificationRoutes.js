const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authMiddleware } = require('../middleware/auth');

router.get('/', authMiddleware, notificationController.getNotifications);
router.put('/', authMiddleware, notificationController.markAsRead);
router.put('/:id', authMiddleware, notificationController.markAsRead);
router.delete('/', authMiddleware, notificationController.clearNotifications);
router.delete('/:id', authMiddleware, notificationController.deleteNotification);

module.exports = router;
