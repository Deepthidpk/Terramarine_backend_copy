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

// Can be viewed by all authenticated users (or public)
router.get('/', speciesController.getAllSpecies);
router.get('/:id', speciesController.getSpeciesById);

// Create species: Authority, Admin, Researcher
router.post(
  '/', 
  authMiddleware, 
  requireRole(['Authority', 'Admin', 'Researcher']), 
  upload.single('image'), 
  speciesController.createSpecies
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
