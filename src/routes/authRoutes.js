const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure Multer for secure uploads
const secureUploadDir = path.join(__dirname, '../../uploads/secure');
if (!fs.existsSync(secureUploadDir)) {
  fs.mkdirSync(secureUploadDir, { recursive: true });
}

const secureStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, secureUploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, 'secure-' + Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.pdf', '.jpg', '.jpeg', '.png'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, JPG, JPEG, and PNG are allowed.'));
  }
};

const secureUpload = multer({
  storage: secureStorage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const uploadFields = secureUpload.fields([
  { name: 'registration_certificate', maxCount: 1 },
  { name: 'institution_id', maxCount: 1 },
  { name: 'government_id', maxCount: 1 }
]);

const handleRegistrationUpload = (req, res, next) => {
  uploadFields(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size too large. Maximum size allowed is 5MB.' });
      }
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

router.post('/register', handleRegistrationUpload, authController.register);
router.post('/login', authController.login);
router.post('/google', authController.googleLogin);
router.post('/google-login', authController.googleLogin);
router.post('/google-complete', handleRegistrationUpload, authController.googleRegister);
router.post('/forgot-password', authController.forgotPassword);

router.post('/reset-password', authController.resetPassword);
router.get('/profile', authMiddleware, authController.getProfile);
router.put('/profile', authMiddleware, authController.updateProfile);
router.get('/test-email', authController.testEmail);
router.post('/test-email', authController.testEmail);

module.exports = router;