const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');

// Create storage configuration with dynamic folder selection
const createStorage = () => {
  return multer.diskStorage({
    destination: async function (req, file, cb) {
      try {
        let folder = 'documents'; // default fallback
        
        // Use different folders based on file type
        if (file.fieldname === 'aadharFile') {
          folder = 'aadhar';
        } else if (file.fieldname === 'signatureFile') {
          folder = 'signatures';
        }
        
        const uploadPath = path.join(process.env.UPLOAD_PATH || './uploads', folder);
        
        // Ensure directory exists
        await fs.ensureDir(uploadPath);
        
        console.log(`📁 Upload destination for ${file.fieldname}: ${uploadPath}`);
        cb(null, uploadPath);
      } catch (error) {
        console.error('❌ Error creating upload directory:', error);
        cb(error, null);
      }
    },
    filename: function (req, file, cb) {
      try {
        // Generate unique filename with timestamp and UUID
        const timestamp = Date.now();
        const randomId = uuidv4().split('-')[0]; // First part of UUID
        const extension = path.extname(file.originalname).toLowerCase();
        const baseName = path.basename(file.originalname, extension)
          .replace(/[^a-zA-Z0-9]/g, '_') // Replace special chars with underscore
          .substring(0, 20); // Limit base name length
        
        const filename = `${timestamp}_${randomId}_${baseName}${extension}`;
        
        console.log(`📝 Generated filename: ${filename} for original: ${file.originalname}`);
        cb(null, filename);
      } catch (error) {
        console.error('❌ Error generating filename:', error);
        cb(error, null);
      }
    }
  });
};

// File filter function
const fileFilter = (req, file, cb) => {
  console.log(`🔍 Checking file: ${file.fieldname} - ${file.originalname} - ${file.mimetype}`);
  
  try {
    const allowedMimeTypes = {
      aadharFile: [
        'image/jpeg',
        'image/jpg', 
        'image/png',
        'application/pdf'
      ],
      signatureFile: [
        'image/jpeg',
        'image/jpg',
        'image/png'
      ]
    };

    const allowedExtensions = {
      aadharFile: ['.jpg', '.jpeg', '.png', '.pdf'],
      signatureFile: ['.jpg', '.jpeg', '.png']
    };

    const fieldAllowedMimes = allowedMimeTypes[file.fieldname];
    const fieldAllowedExts = allowedExtensions[file.fieldname];

    if (!fieldAllowedMimes || !fieldAllowedExts) {
      console.log(`❌ Unknown field: ${file.fieldname}`);
      return cb(new Error(`Unknown file field: ${file.fieldname}`), false);
    }

    // Check MIME type
    if (!fieldAllowedMimes.includes(file.mimetype)) {
      console.log(`❌ Invalid MIME type: ${file.mimetype} for field: ${file.fieldname}`);
      return cb(new Error(`Invalid file type for ${file.fieldname}. Allowed: ${fieldAllowedMimes.join(', ')}`), false);
    }

    // Check file extension
    const fileExtension = path.extname(file.originalname).toLowerCase();
    if (!fieldAllowedExts.includes(fileExtension)) {
      console.log(`❌ Invalid extension: ${fileExtension} for field: ${file.fieldname}`);
      return cb(new Error(`Invalid file extension for ${file.fieldname}. Allowed: ${fieldAllowedExts.join(', ')}`), false);
    }

    // Additional validation for file names
    if (file.originalname.length > 255) {
      return cb(new Error('Filename too long (max 255 characters)'), false);
    }

    // More permissive filename validation - allow common characters
    if (!/^[a-zA-Z0-9._\-\s()[\]{}]+$/.test(file.originalname)) {
      console.log(`❌ Invalid characters in filename: ${file.originalname}`);
      return cb(new Error('Filename contains invalid characters. Only letters, numbers, spaces, and common symbols (._-()[]{}) are allowed.'), false);
    }

    console.log(`✅ File validation passed for: ${file.fieldname}`);
    cb(null, true);

  } catch (error) {
    console.error('❌ Error in file filter:', error);
    cb(error, false);
  }
};

// Create multer instances for different file types
const createMulterConfig = () => {
  const maxSizes = {
    aadharFile: 5 * 1024 * 1024,    // 5MB for Aadhaar
    signatureFile: 2 * 1024 * 1024  // 2MB for signature
  };

  return multer({
    storage: createStorage(), // Remove the hardcoded 'documents' parameter
    fileFilter: fileFilter,
    limits: {
      fileSize: Math.max(...Object.values(maxSizes)), // Use the largest limit
      files: 2, // Maximum 2 files
      fields: 20, // Maximum form fields
      fieldNameSize: 50, // Field name size
      fieldSize: 1024 * 1024, // 1MB field value size
    }
  });
};

// Main upload middleware
const upload = createMulterConfig();

// Upload fields configuration
const uploadFields = upload.fields([
  { 
    name: 'aadharFile', 
    maxCount: 1 
  },
  { 
    name: 'signatureFile', 
    maxCount: 1 
  }
]);

// Enhanced upload middleware with better error handling
const uploadMiddleware = (req, res, next) => {
  console.log('🚀 Starting file upload process...');
  console.log('📊 Request details:', {
    method: req.method,
    url: req.url,
    contentType: req.headers['content-type'],
    contentLength: req.headers['content-length']
  });

  uploadFields(req, res, (err) => {
    if (err) {
      console.error('❌ Upload error:', err);
      
      // Handle specific multer errors
      if (err instanceof multer.MulterError) {
        switch (err.code) {
          case 'LIMIT_FILE_SIZE':
            return res.status(400).json({
              success: false,
              message: 'File too large. Aadhaar files max 5MB, signature files max 2MB.',
              error: 'FILE_TOO_LARGE'
            });
          case 'LIMIT_FILE_COUNT':
            return res.status(400).json({
              success: false,
              message: 'Too many files uploaded.',
              error: 'TOO_MANY_FILES'
            });
          case 'LIMIT_UNEXPECTED_FILE':
            return res.status(400).json({
              success: false,
              message: `Unexpected file field: ${err.field}`,
              error: 'UNEXPECTED_FIELD'
            });
          case 'LIMIT_FIELD_KEY':
            return res.status(400).json({
              success: false,
              message: 'Field name too long.',
              error: 'FIELD_NAME_TOO_LONG'
            });
          case 'LIMIT_FIELD_VALUE':
            return res.status(400).json({
              success: false,
              message: 'Field value too long.',
              error: 'FIELD_VALUE_TOO_LONG'
            });
          case 'LIMIT_FIELD_COUNT':
            return res.status(400).json({
              success: false,
              message: 'Too many fields.',
              error: 'TOO_MANY_FIELDS'
            });
          case 'LIMIT_PART_COUNT':
            return res.status(400).json({
              success: false,
              message: 'Too many parts in multipart data.',
              error: 'TOO_MANY_PARTS'
            });
          default:
            return res.status(400).json({
              success: false,
              message: err.message || 'File upload error',
              error: 'UPLOAD_ERROR'
            });
        }
      }
      
      // Handle custom file validation errors
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload failed',
        error: 'VALIDATION_ERROR'
      });
    }

    // Log uploaded files
    if (req.files) {
      console.log('📁 Files uploaded:');
      Object.keys(req.files).forEach(fieldName => {
        req.files[fieldName].forEach(file => {
          console.log(`  ${fieldName}: ${file.originalname} (${file.size} bytes) -> ${file.filename}`);
        });
      });
    } else {
      console.log('📁 No files uploaded');
    }

    // Validate file requirements
    const requiredFiles = ['aadharFile', 'signatureFile'];
    const missingFiles = [];

    requiredFiles.forEach(fieldName => {
      if (!req.files || !req.files[fieldName] || req.files[fieldName].length === 0) {
        missingFiles.push(fieldName);
      }
    });

    if (missingFiles.length > 0) {
      console.log(`❌ Missing required files: ${missingFiles.join(', ')}`);
      return res.status(400).json({
        success: false,
        message: `Missing required files: ${missingFiles.join(', ')}`,
        error: 'MISSING_FILES',
        missingFiles: missingFiles
      });
    }

    // Additional file size validation per field
    const errors = [];
    
    if (req.files.aadharFile && req.files.aadharFile[0]) {
      const aadharFile = req.files.aadharFile[0];
      if (aadharFile.size > 5 * 1024 * 1024) {
        errors.push('Aadhaar file size cannot exceed 5MB');
      }
    }

    if (req.files.signatureFile && req.files.signatureFile[0]) {
      const signatureFile = req.files.signatureFile[0];
      if (signatureFile.size > 2 * 1024 * 1024) {
        errors.push('Signature file size cannot exceed 2MB');
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'File validation failed',
        errors: errors
      });
    }

    console.log('✅ File upload completed successfully');
    next();
  });
};

// File cleanup utility
const cleanupFiles = async (files) => {
  if (!files || typeof files !== 'object') return;
  
  try {
    const filesToDelete = [];
    
    // Collect all file paths
    Object.keys(files).forEach(fieldName => {
      if (Array.isArray(files[fieldName])) {
        files[fieldName].forEach(file => {
          if (file.path) {
            filesToDelete.push(file.path);
          }
        });
      }
    });

    // Delete files
    for (const filePath of filesToDelete) {
      try {
        if (await fs.pathExists(filePath)) {
          await fs.unlink(filePath);
          console.log(`🗑️ Cleaned up file: ${filePath}`);
        }
      } catch (error) {
        console.error(`❌ Error deleting file ${filePath}:`, error.message);
      }
    }

  } catch (error) {
    console.error('❌ Error in file cleanup:', error);
  }
};

// Get file info utility
const getFileInfo = (file) => {
  if (!file) return null;
  
  return {
    originalName: file.originalname,
    filename: file.filename,
    path: file.path,
    size: file.size,
    mimeType: file.mimetype,
    uploadedAt: new Date()
  };
};

module.exports = {
  uploadMiddleware,
  cleanupFiles,
  getFileInfo,
  upload
};