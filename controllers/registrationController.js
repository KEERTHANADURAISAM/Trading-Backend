const Registration = require('../models/Registration');
const { validationResult } = require('express-validator');
const { cleanupFiles, getFileInfo } = require('../config/multer');
const path = require('path');
const fs = require('fs-extra');

// @desc    Create new registration
// @route   POST /api/registration/register
// @access  Public
const createRegistration = async (req, res) => {
  console.log('🚀 Starting registration process...');
  
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      
      // Cleanup uploaded files on validation error
      if (req.files) {
        await cleanupFiles(req.files);
      }
      
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array().map(error => error.msg)
      });
    }

    console.log('📝 Form data received:', {
      ...req.body,
      aadharNumber: req.body.aadharNumber ? 'HIDDEN' : 'NOT_PROVIDED'
    });

    // Check if files are uploaded
    if (!req.files || !req.files.aadharFile || !req.files.signatureFile) {
      if (req.files) {
        await cleanupFiles(req.files);
      }
      
      return res.status(400).json({
        success: false,
        message: 'Both Aadhaar document and signature files are required'
      });
    }

    const { 
      firstName, 
      lastName, 
      email, 
      phone, 
      dateOfBirth,
      address,
      city,
      state,
      pincode,
      aadharNumber,
      courseName,
      agreeTerms,
      agreeMarketing
    } = req.body;

    // Additional server-side validation with specific field mapping
    const validationErrors = [];

    // Check for duplicate email
    const existingEmail = await Registration.findByEmail(email);
    if (existingEmail) {
      await cleanupFiles(req.files);
      return res.status(400).json({
        success: false,
        message: 'This email address is already registered. Please use a different email or contact support if you believe this is an error.',
        field: 'email',
        duplicateValue: email
      });
    }

    // Check for duplicate phone
    const existingPhone = await Registration.findByPhone(phone);
    if (existingPhone) {
      await cleanupFiles(req.files);
      return res.status(400).json({
        success: false,
        message: 'This phone number is already registered. Please use a different phone number or contact support if you believe this is an error.',
        field: 'phone',
        duplicateValue: phone
      });
    }

    // Check for duplicate Aadhaar
    const existingAadhar = await Registration.findByAadhar(aadharNumber);
    if (existingAadhar) {
      await cleanupFiles(req.files);
      return res.status(400).json({
        success: false,
        message: 'This Aadhaar number is already registered. Please verify your Aadhaar number or contact support if you believe this is an error.',
        field: 'aadharNumber',
        duplicateValue: aadharNumber
      });
    }

    // Validate terms agreement
    if (!agreeTerms || agreeTerms !== 'true') {
      validationErrors.push('You must accept the terms and conditions');
    }

    if (validationErrors.length > 0) {
      console.log('❌ Business logic validation errors:', validationErrors);
      
      // Cleanup uploaded files
      await cleanupFiles(req.files);
      
      return res.status(400).json({
        success: false,
        message: 'Registration validation failed',
        errors: validationErrors
      });
    }

    // Process uploaded files
    const aadharFileInfo = getFileInfo(req.files.aadharFile[0]);
    const signatureFileInfo = getFileInfo(req.files.signatureFile[0]);

    console.log('📁 Processed file info:', {
      aadhar: { ...aadharFileInfo, path: 'HIDDEN' },
      signature: { ...signatureFileInfo, path: 'HIDDEN' }
    });

    // Create registration record
    const registrationData = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.replace(/\D/g, ''),
      dateOfBirth: new Date(dateOfBirth),
      address: address.trim(),
      city: city.trim(),
      state: state.trim(),
      pincode: pincode.replace(/\D/g, ''),
      aadharNumber: aadharNumber.replace(/\D/g, ''),
      courseName: courseName.trim(),
      agreeTerms: true,
      agreeMarketing: agreeMarketing === 'true' || agreeMarketing === true,
      files: {
        aadharFile: aadharFileInfo,
        signatureFile: signatureFileInfo
      },
      ipAddress: req.ip || req.connection.remoteAddress || req.socket.remoteAddress || (req.connection.socket ? req.connection.socket.remoteAddress : null),
      userAgent: req.get('User-Agent')
    };

    console.log('💾 Creating registration record...');
    console.log('📋 Registration data prepared:', {
      ...registrationData,
      aadharNumber: 'HIDDEN',
      files: 'HIDDEN'
    });
    
    const registration = new Registration(registrationData);
    const savedRegistration = await registration.save();

    console.log('✅ Registration created successfully:', savedRegistration._id);

    // Return success response (excluding sensitive data)
    res.status(201).json({
      success: true,
      message: 'Registration completed successfully! We will contact you soon.',
      data: {
        id: savedRegistration._id,
        fullName: savedRegistration.fullName,
        email: savedRegistration.email,
        phone: savedRegistration.phone,
        courseName: savedRegistration.courseName,
        status: savedRegistration.status,
        submittedAt: savedRegistration.submittedAt
      }
    });

  } catch (error) {
    console.error('❌ Registration error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      keyPattern: error.keyPattern,
      keyValue: error.keyValue,
      stack: error.stack,
      fullError: error
    });

    // Cleanup uploaded files on error
    if (req.files) {
      await cleanupFiles(req.files);
    }

    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Registration data validation failed',
        errors: errors
      });
    }

    // Handle duplicate key errors (MongoDB unique index violations)
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      console.error('❌ Duplicate key error details:', {
        field: field,
        keyPattern: error.keyPattern,
        keyValue: error.keyValue,
        message: error.message
      });
      
      const fieldNames = {
        email: 'Email address',
        phone: 'Phone number',
        aadharNumber: 'Aadhaar number'
      };
      
      // Handle unknown/orphaned fields (like registrationId)
      if (!fieldNames[field]) {
        console.error(`❌ Unknown duplicate field: ${field}. This might be an orphaned index.`);
        return res.status(500).json({
          success: false,
          message: 'A database configuration error occurred. Please contact support with error code: ORPHANED_INDEX',
          field: field,
          duplicateValue: error.keyValue ? error.keyValue[field] : 'unknown',
          debugInfo: process.env.NODE_ENV === 'development' ? {
            hint: `Orphaned unique index on field '${field}'. Run: db.registrations.dropIndex("${field}_1")`
          } : undefined
        });
      }
      
      return res.status(400).json({
        success: false,
        message: `${fieldNames[field]} is already registered. Please use a different ${field} or contact support if you believe this is an error.`,
        field: field,
        duplicateValue: error.keyValue ? error.keyValue[field] : 'unknown'
      });
    }

    // Generic error response
    res.status(500).json({
      success: false,
      message: 'Registration failed due to server error. Please try again.',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get all registrations (Admin only)
// @route   GET /api/registration/all
// @access  Private/Admin
const getAllRegistrations = async (req, res) => {
  try {
    console.log('📊 Fetching all registrations...');
    
    const {
      page = 1,
      limit = 10,
      status,
      courseName,
      search,
      sortBy = 'submittedAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (status) {
      filter.status = status;
    }
    
    if (courseName) {
      filter.courseName = { $regex: courseName, $options: 'i' };
    }
    
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [registrations, total] = await Promise.all([
      Registration.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .select('-files.aadharFile.path -files.signatureFile.path'), // Exclude sensitive file paths
      Registration.countDocuments(filter)
    ]);

    // Get statistics
    const stats = await Registration.getRegistrationStats();

    console.log(`✅ Found ${registrations.length} registrations (${total} total)`);

    res.json({
      success: true,
      data: {
        registrations,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalRecords: total,
          hasNext: skip + parseInt(limit) < total,
          hasPrev: parseInt(page) > 1
        },
        stats: stats[0] || { total: 0, stats: [] }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching registrations:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch registrations',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get single registration
// @route   GET /api/registration/:id
// @access  Private/Admin
const getRegistrationById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔍 Fetching registration: ${id}`);

    const registration = await Registration.findById(id)
      .select('-files.aadharFile.path -files.signatureFile.path'); // Exclude sensitive paths

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    console.log('✅ Registration found');

    res.json({
      success: true,
      data: registration
    });

  } catch (error) {
    console.error('❌ Error fetching registration:', error);

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid registration ID format'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to fetch registration',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Update registration status
// @route   PUT /api/registration/:id/status
// @access  Private/Admin
const updateRegistrationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, reviewedBy } = req.body;
    
    console.log(`📝 Updating registration status: ${id} -> ${status}`);

    // Match frontend values exactly (lowercase)
    const validStatuses = ['pending', 'approved', 'rejected', 'under_review'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const registration = await Registration.findById(id);
    
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    // Update registration status
    let updatedRegistration;
    
    switch (status) {
      case 'approved':
        // If you have approve method
        if (typeof registration.approve === 'function') {
          updatedRegistration = await registration.approve(reviewedBy, notes);
        } else {
          registration.status = status;
          registration.reviewedAt = new Date();
          registration.reviewedBy = reviewedBy || 'Admin';
          if (notes) registration.notes = notes;
          updatedRegistration = await registration.save();
        }
        break;
        
      case 'rejected':
        // If you have reject method
        if (typeof registration.reject === 'function') {
          updatedRegistration = await registration.reject(reviewedBy, notes);
        } else {
          registration.status = status;
          registration.reviewedAt = new Date();
          registration.reviewedBy = reviewedBy || 'Admin';
          if (notes) registration.notes = notes;
          updatedRegistration = await registration.save();
        }
        break;
        
      case 'under_review':
        // If you have setUnderReview method
        if (typeof registration.setUnderReview === 'function') {
          updatedRegistration = await registration.setUnderReview(reviewedBy, notes);
        } else {
          registration.status = status;
          registration.reviewedAt = new Date();
          registration.reviewedBy = reviewedBy || 'Admin';
          if (notes) registration.notes = notes;
          updatedRegistration = await registration.save();
        }
        break;
        
      default:
        // For 'pending' or any other status
        registration.status = status;
        registration.reviewedAt = new Date();
        registration.reviewedBy = reviewedBy || 'Admin';
        if (notes) registration.notes = notes;
        updatedRegistration = await registration.save();
    }

    console.log('✅ Registration status updated successfully');

    res.json({
      success: true,
      message: 'Registration status updated successfully',
      data: {
        id: updatedRegistration._id,
        status: updatedRegistration.status,
        reviewedAt: updatedRegistration.reviewedAt,
        reviewedBy: updatedRegistration.reviewedBy,
        notes: updatedRegistration.notes
      }
    });

  } catch (error) {
    console.error('❌ Error updating registration status:', error);

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid registration ID format'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update registration status',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Update registration details
// @route   PUT /api/registration/:id
// @access  Private/Admin
const updateRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, phone, courseName, status } = req.body;
    
    console.log(`📝 Updating registration: ${id}`);

    const registration = await Registration.findById(id);
    
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    // Check for duplicate email (if changed)
    if (email && email !== registration.email) {
      const existingEmail = await Registration.findByEmail(email);
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: 'This email address is already registered',
          field: 'email'
        });
      }
    }

    // Check for duplicate phone (if changed)
    if (phone && phone !== registration.phone) {
      const existingPhone = await Registration.findByPhone(phone);
      if (existingPhone) {
        return res.status(400).json({
          success: false,
          message: 'This phone number is already registered',
          field: 'phone'
        });
      }
    }

    // Update fields
    if (firstName) registration.firstName = firstName.trim();
    if (lastName) registration.lastName = lastName.trim();
    if (email) registration.email = email.toLowerCase().trim();
    if (phone) registration.phone = phone.replace(/\D/g, '');
    if (courseName) registration.courseName = courseName.trim();
    if (status) registration.status = status;

    const updatedRegistration = await registration.save();

    console.log('✅ Registration updated successfully');

    res.json({
      success: true,
      message: 'Registration updated successfully',
      data: {
        id: updatedRegistration._id,
        firstName: updatedRegistration.firstName,
        lastName: updatedRegistration.lastName,
        email: updatedRegistration.email,
        phone: updatedRegistration.phone,
        courseName: updatedRegistration.courseName,
        status: updatedRegistration.status,
        fullName: updatedRegistration.fullName
      }
    });

  } catch (error) {
    console.error('❌ Error updating registration:', error);

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid registration ID format'
      });
    }

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${field} is already in use`,
        field: field
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update registration',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Delete registration
// @route   DELETE /api/registration/:id
// @access  Private/Admin
const deleteRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🗑️ Deleting registration: ${id}`);

    const registration = await Registration.findById(id);
    
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    // Cleanup associated files
    const filesToDelete = [];
    if (registration.files.aadharFile?.path) {
      filesToDelete.push(registration.files.aadharFile.path);
    }
    if (registration.files.signatureFile?.path) {
      filesToDelete.push(registration.files.signatureFile.path);
    }

    // Delete files from filesystem
    for (const filePath of filesToDelete) {
      try {
        if (await fs.pathExists(filePath)) {
          await fs.unlink(filePath);
          console.log(`🗑️ Deleted file: ${filePath}`);
        }
      } catch (fileError) {
        console.error(`❌ Error deleting file ${filePath}:`, fileError.message);
        // Continue with deletion even if file cleanup fails
      }
    }

    // Delete registration record
    await Registration.findByIdAndDelete(id);

    console.log('✅ Registration deleted successfully');

    res.json({
      success: true,
      message: 'Registration deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting registration:', error);

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid registration ID format'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to delete registration',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get registration statistics
// @route   GET /api/registration/stats
// @access  Private/Admin
const getRegistrationStats = async (req, res) => {
  try {
    console.log('📊 Fetching registration statistics...');

    const stats = await Registration.getRegistrationStats();
    
    // Get additional statistics
    const [
      totalToday,
      totalThisWeek,
      totalThisMonth,
      recentRegistrations
    ] = await Promise.all([
      Registration.countDocuments({
        submittedAt: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0))
        }
      }),
      Registration.countDocuments({
        submittedAt: {
          $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      }),
      Registration.countDocuments({
        submittedAt: {
          $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        }
      }),
      Registration.find()
        .sort({ submittedAt: -1 })
        .limit(5)
        .select('firstName lastName email courseName status submittedAt')
    ]);

    console.log('✅ Statistics compiled successfully');

    res.json({
      success: true,
      data: {
        overview: stats[0] || { total: 0, stats: [] },
        timeline: {
          today: totalToday,
          thisWeek: totalThisWeek,
          thisMonth: totalThisMonth
        },
        recentRegistrations
      }
    });

  } catch (error) {
    console.error('❌ Error fetching statistics:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

module.exports = {
  createRegistration,
  getAllRegistrations,
  getRegistrationById,
  updateRegistrationStatus,
  updateRegistration,
  deleteRegistration,
  getRegistrationStats
};