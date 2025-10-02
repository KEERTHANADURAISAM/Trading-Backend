const { body, param, query } = require('express-validator');

// Custom validators
const customValidators = {
  isValidAadhaar: (value) => {
    if (!value) return false;
    
    // Remove any spaces or formatting
    const cleanNumber = value.replace(/\D/g, '');
    
    // Check if it's exactly 12 digits
    if (!/^\d{12}$/.test(cleanNumber)) {
      return false;
    }
    
    // First digit should be 2-9 (Aadhaar specification)
    if (!/^[2-9]/.test(cleanNumber)) {
      return false;
    }
    
    // Check if all digits are the same (invalid pattern)
    if (/^(\d)\1{11}$/.test(cleanNumber)) {
      return false;
    }
    
    // Check for sequential patterns (basic check)
    if (cleanNumber === '123456789012' || cleanNumber === '987654321098') {
      return false;
    }
    
    return true;
  },

  isValidAge: (dateOfBirth) => {
    if (!dateOfBirth) return false;
    
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    
    // Check if date is valid
    if (isNaN(birthDate.getTime())) return false;
    
    // Check if date is not in future
    if (birthDate > today) return false;
    
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age >= 18 && age <= 100;
  },

  isValidIndianPhone: (phone) => {
    if (!phone) return false;
    const cleanPhone = phone.replace(/\D/g, '');
    return /^[6789]\d{9}$/.test(cleanPhone);
  },

  isValidPincode: (pincode) => {
    if (!pincode) return false;
    const cleanPincode = pincode.replace(/\D/g, '');
    return /^[1-9]\d{5}$/.test(cleanPincode);
  },

  isValidName: (name) => {
    if (!name) return false;
    return /^[a-zA-Z\s]+$/.test(name.trim());
  }
};

// Registration validation rules
const registrationValidation = [
  // Personal Information
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters')
    .custom(customValidators.isValidName)
    .withMessage('First name can only contain letters and spaces'),

  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters')
    .custom(customValidators.isValidName)
    .withMessage('Last name can only contain letters and spaces'),

  body('email')
    .trim()
    .normalizeEmail()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .isLength({ max: 100 })
    .withMessage('Email cannot exceed 100 characters'),

  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .custom(customValidators.isValidIndianPhone)
    .withMessage('Phone number must be 10 digits starting with 6, 7, 8, or 9'),

  body('dateOfBirth')
    .notEmpty()
    .withMessage('Date of birth is required')
    .isISO8601()
    .withMessage('Please provide a valid date')
    .custom(customValidators.isValidAge)
    .withMessage('Age must be between 18 and 100 years, and date cannot be in the future'),

  // Address Information
  body('address')
    .trim()
    .notEmpty()
    .withMessage('Address is required')
    .isLength({ min: 10, max: 200 })
    .withMessage('Address must be between 10 and 200 characters'),

  body('city')
    .trim()
    .notEmpty()
    .withMessage('City is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('City must be between 2 and 50 characters')
    .custom(customValidators.isValidName)
    .withMessage('City can only contain letters and spaces'),

  body('state')
    .trim()
    .notEmpty()
    .withMessage('State is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('State must be between 2 and 50 characters')
    .custom(customValidators.isValidName)
    .withMessage('State can only contain letters and spaces'),

  body('pincode')
    .trim()
    .notEmpty()
    .withMessage('Pincode is required')
    .custom(customValidators.isValidPincode)
    .withMessage('Pincode must be 6 digits and cannot start with 0'),

  // Identity Information
  body('aadharNumber')
    .trim()
    .notEmpty()
    .withMessage('Aadhaar number is required')
    .custom(customValidators.isValidAadhaar)
    .withMessage('Please enter a valid 12-digit Aadhaar number'),

  // Course Information
  body('courseName')
    .trim()
    .notEmpty()
    .withMessage('Course name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Course name must be between 2 and 100 characters'),

  // Agreements
  body('agreeTerms')
    .notEmpty()
    .withMessage('You must accept the terms and conditions')
    .custom((value) => {
      return value === 'true' || value === true;
    })
    .withMessage('You must accept the terms and conditions'),

  body('agreeMarketing')
    .optional()
    .isBoolean()
    .withMessage('Marketing agreement must be boolean')
];

// ID parameter validation
const validateObjectId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ID format'),
  
  param('registrationId')
    .optional()
    .isMongoId()
    .withMessage('Invalid registration ID format')
];

// File type validation
const validateFileType = [
  param('fileType')
    .isIn(['aadhar', 'signature'])
    .withMessage('File type must be either "aadhar" or "signature"')
];

// Status update validation
const statusUpdateValidation = [
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['pending', 'approved', 'rejected', 'under_review'])
    .withMessage('Status must be one of: pending, approved, rejected, under_review'),

  body('reviewedBy')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Reviewed by must be between 2 and 100 characters'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters')
];

// Query validation for listing endpoints
const listingQueryValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),

  query('status')
    .optional()
    .isIn(['pending', 'approved', 'rejected', 'under_review'])
    .withMessage('Status must be one of: pending, approved, rejected, under_review'),

  query('courseName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Course name must be between 1 and 100 characters'),

  query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters'),

  query('sortBy')
    .optional()
    .isIn(['submittedAt', 'firstName', 'lastName', 'email', 'status', 'courseName'])
    .withMessage('Sort by must be one of: submittedAt, firstName, lastName, email, status, courseName'),

  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be either "asc" or "desc"')
];

// Sanitization middleware
const sanitizeInput = (req, res, next) => {
  // Sanitize string fields
  const stringFields = ['firstName', 'lastName', 'email', 'address', 'city', 'state', 'courseName', 'notes', 'reviewedBy'];
  
  stringFields.forEach(field => {
    if (req.body[field] && typeof req.body[field] === 'string') {
      // Remove potentially dangerous characters but keep necessary punctuation
      req.body[field] = req.body[field]
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+\s*=/gi, '') // Remove event handlers
        .trim();
    }
  });

  // Sanitize numeric fields
  const numericFields = ['phone', 'pincode', 'aadharNumber'];
  
  numericFields.forEach(field => {
    if (req.body[field] && typeof req.body[field] === 'string') {
      // Keep only digits and spaces (for formatting)
      req.body[field] = req.body[field].replace(/[^\d\s]/g, '');
    }
  });

  // Convert boolean fields
  const booleanFields = ['agreeTerms', 'agreeMarketing'];
  
  booleanFields.forEach(field => {
    if (req.body[field] !== undefined) {
      req.body[field] = req.body[field] === 'true' || req.body[field] === true;
    }
  });

  console.log('🧹 Input sanitization completed');
  next();
};

// Rate limiting validation
const rateLimitValidation = (windowMs = 15 * 60 * 1000, max = 5) => {
  const requests = new Map();
  
  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    // Clean old entries
    for (const [ip, data] of requests.entries()) {
      if (now - data.firstRequest > windowMs) {
        requests.delete(ip);
      }
    }
    
    // Check current IP
    const userRequests = requests.get(key);
    
    if (!userRequests) {
      requests.set(key, { count: 1, firstRequest: now });
      return next();
    }
    
    if (now - userRequests.firstRequest > windowMs) {
      requests.set(key, { count: 1, firstRequest: now });
      return next();
    }
    
    if (userRequests.count >= max) {
      return res.status(429).json({
        success: false,
        message: 'Too many registration attempts. Please try again later.',
        retryAfter: Math.ceil((windowMs - (now - userRequests.firstRequest)) / 1000)
      });
    }
    
    userRequests.count++;
    next();
  };
};

module.exports = {
  registrationValidation,
  validateObjectId,
  validateFileType,
  statusUpdateValidation,
  listingQueryValidation,
  sanitizeInput,
  rateLimitValidation,
  customValidators
};