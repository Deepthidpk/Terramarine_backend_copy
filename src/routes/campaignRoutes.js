const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaignController');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.post('/', authMiddleware, requireRole(['NGO', 'Authority', 'Admin']), campaignController.createCampaign);
router.get('/', authMiddleware, campaignController.getCampaigns);
router.get('/my-history', authMiddleware, campaignController.getMyHistory);
router.get('/:id', authMiddleware, campaignController.getCampaignById);
router.post('/:id/join', authMiddleware, campaignController.joinCampaign);
router.put('/:id/status', authMiddleware, requireRole(['NGO', 'Authority', 'Admin']), campaignController.updateCampaignStatus);
router.put('/:id/attendance', authMiddleware, requireRole(['NGO', 'Authority', 'Admin']), campaignController.updateAttendance);
router.put('/:id/volunteers/:volunteer_id/status', authMiddleware, requireRole(['NGO', 'Authority', 'Admin']), campaignController.updateVolunteerStatus);

module.exports = router;
