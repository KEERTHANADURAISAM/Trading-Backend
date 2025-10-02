const express = require('express');
const router = express.Router();

// Import controllers
const {
  createRegistration,
  getAllRegistrations,
  getRegistrationById,
  updateRegistrationStatus,
  deleteRegistration,
  getRegistrationStats
} = require('../controllers/registrationController');

// Import file controllers for direct registration file access
const {
  downloadFile,
  viewFile,
  getFileInfo
} = require('../controllers/fileController');

// Import middleware
const { uploadMiddleware } = require('../config/multer');
const {
  registrationValidation,
  validateObjectId,
  statusUpdateValidation,
  listingQueryValidation,
  sanitizeInput,
  rateLimitValidation,
  validateFileType
} = require('../middleware/validation');

// @desc    Create new registration
// @route   POST /api/registration/register
// @access  Public
router.post(
  '/register',
  rateLimitValidation(15 * 60 * 1000, 3), // 3 attempts per 15 minutes
  sanitizeInput,
  uploadMiddleware,
  registrationValidation,
  createRegistration
);

// @desc    Get registration statistics
// @route   GET /api/registration/stats
// @access  Private/Admin
router.get('/stats', getRegistrationStats);

// @desc    Get all registrations with filtering and pagination
// @route   GET /api/registration/all
// @access  Private/Admin
router.get('/all', listingQueryValidation, getAllRegistrations);

// @desc    Get single registration by ID
// @route   GET /api/registration/:id
// @access  Private/Admin
router.get('/:id', validateObjectId, getRegistrationById);

// @desc    Update registration status
// @route   PUT /api/registration/:id/status (Changed from PATCH to PUT to match frontend)
// @access  Private/Admin
router.put(
  '/:id/status',
  validateObjectId,
  statusUpdateValidation,
  updateRegistrationStatus
);

// @desc    Delete registration
// @route   DELETE /api/registration/:id
// @access  Private/Admin
router.delete('/:id', validateObjectId, deleteRegistration);

// FILE ROUTES - Added to match frontend expectations
// @desc    Download file from registration
// @route   GET /api/registration/:id/download/:fileType
// @access  Private/Admin
router.get(
  '/:id/download/:fileType',
  validateObjectId,
  validateFileType,
  (req, res, next) => {
    // Map the route params to match fileController expectations
    req.params.registrationId = req.params.id;
    next();
  },
  downloadFile
);

// @desc    View file from registration
// @route   GET /api/registration/:id/view/:fileType
// @access  Private/Admin
router.get(
  '/:id/view/:fileType',
  validateObjectId,
  validateFileType,
  (req, res, next) => {
    // Map the route params to match fileController expectations
    req.params.registrationId = req.params.id;
    next();
  },
  viewFile
);

// @desc    Get file info from registration
// @route   GET /api/registration/:id/file/:fileType
// @access  Private/Admin
router.get(
  '/:id/file/:fileType',
  validateObjectId,
  validateFileType,
  (req, res, next) => {
    // Map the route params to match fileController expectations
    req.params.registrationId = req.params.id;
    next();
  },
  getFileInfo
);

// Health check route for registration service
router.get('/health/check', (req, res) => {
  res.json({
    success: true,
    service: 'Registration Service',
    status: 'active',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;