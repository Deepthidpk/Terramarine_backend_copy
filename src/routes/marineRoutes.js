const express = require('express');
const router = express.Router();
const marineController = require('../controllers/marineController');
const { authMiddleware } = require('../middleware/auth');

// All marine endpoints require user authentication
router.use(authMiddleware);

router.get('/sea-bulletin', marineController.getSeaBulletin);
router.get('/coastal-bulletin', marineController.getCoastalBulletin);
router.get('/alerts', marineController.getOfficialAlerts);
router.get('/status', marineController.getMarineStatus);

module.exports = router;
