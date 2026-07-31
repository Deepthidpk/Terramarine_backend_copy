const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.get('/', authMiddleware, paymentController.getPayments);
router.put('/:id/pay', authMiddleware, requireRole(['Authority', 'Admin']), paymentController.processPayment);

module.exports = router;
