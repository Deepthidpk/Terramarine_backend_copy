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
    cb(null, 'biodiversity-' + Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

router.post('/biodiversity', authMiddleware, requireRole(['Researcher', 'Admin']), upload.single('image'), researcherController.createBiodiversityReport);
router.get('/biodiversity', authMiddleware, researcherController.getBiodiversityReports);

module.exports = router;
