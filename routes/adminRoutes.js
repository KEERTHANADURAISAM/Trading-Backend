const express = require('express');
const router = express.Router();

// Import controllers
const {
  getDashboardOverview,
  getRegistrationAnalytics,
  exportRegistrations
} = require('../controllers/adminController');

// Import middleware
const {
  listingQueryValidation
} = require('../middleware/validation');

// @desc    Get dashboard overview with stats
// @route   GET /api/admin/dashboard
// @access  Private/Admin
router.get('/dashboard', getDashboardOverview);

// @desc    Get registration analytics
// @route   GET /api/admin/analytics/registrations
// @access  Private/Admin
router.get('/analytics/registrations', getRegistrationAnalytics);

// @desc    Export registrations data
// @route   GET /api/admin/export/registrations
// @access  Private/Admin
router.get('/export/registrations', listingQueryValidation, exportRegistrations);

// Health check for admin service
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'Admin Service',
    status: 'active',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;