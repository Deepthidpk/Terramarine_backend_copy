const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authMiddleware, requireRole } = require('../middleware/auth');

// Protect all routes in this router with System Admin authentication
router.use(authMiddleware);

// Document download route accessible by all authenticated users (Admin & Authority) for verifying documents
router.get('/documents/:filename', adminController.downloadDocument);

router.use(requireRole(['Admin']));

// 1. Onboard & Manage Organizations (Municipal Authorities)
router.get('/organizations', adminController.getOrganizations);
router.post('/organizations', adminController.createOrganization);

// 2 & 5. Licenses & Account Statuses
router.put('/organizations/:id/subscription', adminController.updateSubscription);

// 3 & 7. Platform Settings & Security/Authentication Policies
router.get('/settings', adminController.getSettings);
router.put('/settings', adminController.updateSettings);

// 4. Manage Organization Administrators
router.get('/org-admins', adminController.getOrgAdmins);

// 6. Monitor Platform Health & Performance
router.get('/system-health', adminController.getSystemHealth);

// 8. Publish Platform Updates & Maintenance Broadcasts
router.get('/announcements', adminController.getAnnouncements);
router.post('/announcements', adminController.createAnnouncement);
router.delete('/announcements/:id', adminController.deleteAnnouncement);

// 9. Monitor System Logs & Audit Trails
router.get('/system-logs', adminController.getAuditLogs);

// 10. Perform Database Backup & Disaster Recovery
router.post('/backup/trigger', adminController.triggerBackup);
router.get('/backup/history', adminController.getBackupHistory);

// 11. Platform Usage Reports
router.get('/subscription-reports', adminController.getSubscriptionReports);

// 12. Technical Support Helpdesk
router.get('/support-tickets', adminController.getSupportTickets);
router.put('/support-tickets/:id', adminController.updateSupportTicket);

// Legacy support endpoints
router.get('/users', adminController.getUsers);
router.post('/users', adminController.createUser);
router.put('/users/:id/status', adminController.updateUserStatus);
router.get('/documents/:filename', adminController.downloadDocument);

module.exports = router;
