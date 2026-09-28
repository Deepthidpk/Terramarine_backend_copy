const express = require('express');
const router = express.Router();
const marineController = require('../controllers/marineController');
const locationController = require('../controllers/fishermanLocationController');
const { authMiddleware, requireRole } = require('../middleware/auth');

// All endpoints require authentication
router.use(authMiddleware);

// Location Setup Endpoints (Fisherman role only)
router.get('/location', requireRole('Fisherman'), locationController.getLocation);
router.put('/location', requireRole('Fisherman'), locationController.updateLocation);
router.get('/marine/location', requireRole('Fisherman'), locationController.getLocation);
router.put('/marine/location', requireRole('Fisherman'), locationController.updateLocation);

// Weather & Marine Bulletin Endpoints
router.get('/sea-bulletin', marineController.getSeaBulletin);
router.get('/marine/sea-bulletin', marineController.getSeaBulletin);

router.get('/coastal-bulletin', marineController.getCoastalBulletin);
router.get('/marine/coastal-bulletin', marineController.getCoastalBulletin);

router.get('/alerts', marineController.getOfficialAlerts);
router.get('/marine/alerts', marineController.getOfficialAlerts);

router.get('/status', marineController.getMarineStatus);
router.get('/marine/status', marineController.getMarineStatus);

// Strictly Location-Scoped Relevant Alerts Endpoint (Fisherman role only)
router.get('/relevant-alerts', requireRole('Fisherman'), locationController.getRelevantAlerts);
router.get('/marine/relevant-alerts', requireRole('Fisherman'), locationController.getRelevantAlerts);

module.exports = router;
