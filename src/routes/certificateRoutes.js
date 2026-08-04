const express = require('express');
const router = express.Router();
const certificateController = require('../controllers/certificateController');
const { authMiddleware } = require('../middleware/auth');

router.get('/my-certificates', authMiddleware, certificateController.getMyCertificates);
router.get('/:id', authMiddleware, certificateController.getCertificateById);

module.exports = router;
