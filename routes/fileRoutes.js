const express = require('express');
const router = express.Router();

// Import controllers
const {
  downloadFile,
  downloadAllFiles,
  viewFile,
  getFileInfo,
  deleteFile,
  getStorageStats
} = require('../controllers/fileController');

// Import middleware
const {
  validateObjectId,
  validateFileType
} = require('../middleware/validation');

// @desc    Get storage statistics
// @route   GET /api/files/stats
// @access  Private/Admin (Note: Add auth middleware in production)
router.get('/stats', getStorageStats);

// @desc    Download single file
// @route   GET /api/files/download/:registrationId/:fileType
// @access  Private/Admin (Note: Add auth middleware in production)
router.get(
  '/download/:registrationId/:fileType',
  validateObjectId,
  validateFileType,
  downloadFile
);

// @desc    Download all files for a registration as ZIP
// @route   GET /api/files/download-all/:registrationId
// @access  Private/Admin (Note: Add auth middleware in production)
router.get(
  '/download-all/:registrationId',
  validateObjectId,
  downloadAllFiles
);

// @desc    View file (stream for preview)
// @route   GET /api/files/view/:registrationId/:fileType
// @access  Private/Admin (Note: Add auth middleware in production)
router.get(
  '/view/:registrationId/:fileType',
  validateObjectId,
  validateFileType,
  viewFile
);

// @desc    Get file information
// @route   GET /api/files/info/:registrationId/:fileType
// @access  Private/Admin (Note: Add auth middleware in production)
router.get(
  '/info/:registrationId/:fileType',
  validateObjectId,
  validateFileType,
  getFileInfo
);

// @desc    Delete file
// @route   DELETE /api/files/:registrationId/:fileType
// @access  Private/Admin (Note: Add auth middleware in production)
router.delete(
  '/:registrationId/:fileType',
  validateObjectId,
  validateFileType,
  deleteFile
);

// Health check route for file service
router.get('/health/check', (req, res) => {
  res.json({
    success: true,
    service: 'File Service',
    status: 'active',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;