const express = require('express');
const router = express.Router();
const speciesController = require('../controllers/speciesController');
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
    cb(null, 'species-' + Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB max
});

// Category endpoints (MUST be defined before /:id)
router.get('/categories', speciesController.getSpeciesCategories);
router.post(
  '/categories',
  authMiddleware,
  requireRole(['Authority', 'Admin']),
  speciesController.addSpeciesCategory
);
router.delete(
  '/categories/:id',
  authMiddleware,
  requireRole(['Authority', 'Admin']),
  speciesController.deleteSpeciesCategory
);

// Specific routes before /:id parameter match
router.get(
  '/submissions', 
  authMiddleware, 
  requireRole(['Authority', 'Admin']), 
  speciesController.getSpeciesSubmissions
);

router.get(
  '/my-submissions', 
  authMiddleware, 
  speciesController.getMySubmissions
);

// Species Catalog endpoints
router.get('/', speciesController.getAllSpecies);
router.get('/:id', speciesController.getSpeciesById);

// Create / Submit species: Authority, Admin, Researcher
router.post(
  '/', 
  authMiddleware, 
  requireRole(['Authority', 'Admin', 'Researcher']), 
  upload.single('image'), 
  speciesController.createSpecies
);

// Approve Species Submission: Authority, Admin
router.put(
  '/:id/approve',
  authMiddleware,
  requireRole(['Authority', 'Admin']),
  speciesController.approveSpecies
);

// Reject Species Submission: Authority, Admin
router.put(
  '/:id/reject',
  authMiddleware,
  requireRole(['Authority', 'Admin']),
  speciesController.rejectSpecies
);

// Update species: Authority, Admin, Researcher
router.put(
  '/:id', 
  authMiddleware, 
  requireRole(['Authority', 'Admin', 'Researcher']), 
  upload.single('image'), 
  speciesController.updateSpecies
);

// Delete species: Authority, Admin
router.delete(
  '/:id', 
  authMiddleware, 
  requireRole(['Authority', 'Admin']), 
  speciesController.deleteSpecies
);

module.exports = router;
