const express = require('express');
const router = express.Router();
const researcherController = require('../controllers/researcherController');
const { authMiddleware, requireRole } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const prefix = file.fieldname === 'file' ? 'dataset-' : 'biodiversity-';
    cb(null, prefix + Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Role check helper for Researcher or Admin
const isResearcherOrAdmin = requireRole(['Researcher', 'Admin']);

// 1. Biodiversity observations (Existing)
router.post('/biodiversity', authMiddleware, isResearcherOrAdmin, upload.single('image'), researcherController.createBiodiversityReport);
router.get('/biodiversity', authMiddleware, researcherController.getBiodiversityReports);

// 2. Research Projects
router.post('/projects', authMiddleware, isResearcherOrAdmin, researcherController.createProject);
router.get('/projects', authMiddleware, researcherController.getProjects);
router.delete('/projects/:id', authMiddleware, isResearcherOrAdmin, researcherController.deleteProject);

// 3. Research Datasets
router.post('/datasets', authMiddleware, isResearcherOrAdmin, upload.single('file'), researcherController.uploadDataset);
router.get('/datasets', authMiddleware, researcherController.getDatasets);
router.delete('/datasets/:id', authMiddleware, isResearcherOrAdmin, researcherController.deleteDataset);

// 4. Research Alerts
router.post('/alerts', authMiddleware, isResearcherOrAdmin, researcherController.createAlert);
router.get('/alerts', authMiddleware, researcherController.getAlerts);
router.delete('/alerts/:id', authMiddleware, isResearcherOrAdmin, researcherController.deleteAlert);
router.put('/alerts/:id/toggle', authMiddleware, isResearcherOrAdmin, researcherController.toggleAlert);

// 5. Research Reports
router.post('/reports', authMiddleware, isResearcherOrAdmin, researcherController.createReport);
router.get('/reports', authMiddleware, researcherController.getReports);
router.delete('/reports/:id', authMiddleware, isResearcherOrAdmin, researcherController.deleteReport);

// 6. AI Assistant Chat
router.post('/assistant/chat', authMiddleware, researcherController.chatAssistant);

// 7. AI Species Identification
router.post('/identify', authMiddleware, isResearcherOrAdmin, upload.single('image'), researcherController.identifySpecies);

module.exports = router;
