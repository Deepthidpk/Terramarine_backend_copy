const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
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
    cb(null, 'task-' + Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

router.post('/', authMiddleware, requireRole(['Authority', 'Admin']), taskController.createTask);
router.get('/', authMiddleware, taskController.getTasks);
router.get('/:id', authMiddleware, taskController.getTaskById);
router.put('/:id/accept', authMiddleware, taskController.acceptTask);
router.put('/:id/status', authMiddleware, upload.single('image'), taskController.updateTaskStatus);

module.exports = router;
