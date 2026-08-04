const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Ensure upload directories exist
const uploadDirs = ['images', 'videos', 'audio', 'files', 'avatars', 'stories'];
uploadDirs.forEach(dir => {
  const fullPath = path.join(__dirname, '..', '..', 'uploads', dir);
  if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
});

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = 'files';
    if (file.mimetype.startsWith('image/')) folder = 'images';
    else if (file.mimetype.startsWith('video/')) folder = 'videos';
    else if (file.mimetype.startsWith('audio/')) folder = 'audio';
    cb(null, path.join(__dirname, '..', '..', 'uploads', folder));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    cb(null, true);
  }
});

// Upload file
router.post('/upload', authMiddleware, upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    let folder = 'files';
    if (req.file.mimetype.startsWith('image/')) folder = 'images';
    else if (req.file.mimetype.startsWith('video/')) folder = 'videos';
    else if (req.file.mimetype.startsWith('audio/')) folder = 'audio';

    const fileUrl = `/uploads/${folder}/${req.file.filename}`;

    res.json({
      url: fileUrl,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      filename: req.file.filename
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Upload avatar
router.post('/avatar', authMiddleware, upload.single('avatar'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // Move to avatars directory
    const avatarPath = path.join(__dirname, '..', '..', 'uploads', 'avatars', req.file.filename);
    fs.renameSync(req.file.path, avatarPath);

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    const db = req.app.get('db');
    db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatarUrl, req.userId);

    res.json({ url: avatarUrl });
  } catch (err) {
    console.error('Avatar upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Upload multiple files
router.post('/upload-multiple', authMiddleware, upload.array('files', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

    const results = req.files.map(file => {
      let folder = 'files';
      if (file.mimetype.startsWith('image/')) folder = 'images';
      else if (file.mimetype.startsWith('video/')) folder = 'videos';
      else if (file.mimetype.startsWith('audio/')) folder = 'audio';

      return {
        url: `/uploads/${folder}/${file.filename}`,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype
      };
    });

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Upload base64 (for voice messages, screenshots)
router.post('/upload-base64', authMiddleware, (req, res) => {
  try {
    const { data, type = 'audio', extension = 'webm' } = req.body;
    if (!data) return res.status(400).json({ error: 'No data provided' });

    const buffer = Buffer.from(data.replace(/^data:[^;]+;base64,/, ''), 'base64');
    const filename = `${uuidv4()}.${extension}`;
    const folder = type === 'image' ? 'images' : type === 'video' ? 'videos' : 'audio';
    const filePath = path.join(__dirname, '..', '..', 'uploads', folder, filename);

    fs.writeFileSync(filePath, buffer);

    res.json({
      url: `/uploads/${folder}/${filename}`,
      size: buffer.length,
      filename
    });
  } catch (err) {
    res.status(500).json({ error: 'Upload failed' });
  }
});

module.exports = router;
