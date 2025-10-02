const Registration = require('../models/Registration');
const path = require('path');
const fs = require('fs-extra');
const archiver = require('archiver');

// @desc    Download single file
// @route   GET /api/files/download/:registrationId/:fileType
// @access  Private/Admin
const downloadFile = async (req, res) => {
  try {
    const { registrationId, fileType } = req.params;
    
    console.log(`📥 Download request - Registration: ${registrationId}, File: ${fileType}`);

    // Validate file type
    const allowedFileTypes = ['aadhar', 'signature'];
    if (!allowedFileTypes.includes(fileType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Must be "aadhar" or "signature"'
      });
    }

    // Find registration
    const registration = await Registration.findById(registrationId);
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    // Get file info
    const fileField = fileType === 'aadhar' ? 'aadharFile' : 'signatureFile';
    const fileInfo = registration.files[fileField];
    
    if (!fileInfo || !fileInfo.path) {
      return res.status(404).json({
        success: false,
        message: `${fileType} file not found`
      });
    }

    const filePath = path.resolve(fileInfo.path);
    
    // Check if file exists on filesystem
    if (!await fs.pathExists(filePath)) {
      console.error(`❌ File not found on filesystem: ${filePath}`);
      return res.status(404).json({
        success: false,
        message: 'File not found on server'
      });
    }

    // Get file stats
    const stats = await fs.stat(filePath);
    
    // Set appropriate headers
    res.set({
      'Content-Type': fileInfo.mimeType || 'application/octet-stream',
      'Content-Length': stats.size,
      'Content-Disposition': `attachment; filename="${fileInfo.originalName}"`,
      'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    console.log(`✅ Streaming file: ${fileInfo.originalName} (${stats.size} bytes)`);

    // Create read stream and pipe to response
    const readStream = fs.createReadStream(filePath);
    
    readStream.on('error', (error) => {
      console.error('❌ File streaming error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Error reading file'
        });
      }
    });

    readStream.pipe(res);

  } catch (error) {
    console.error('❌ Download error:', error);

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid registration ID format'
      });
    }

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'File download failed',
        ...(process.env.NODE_ENV === 'development' && { error: error.message })
      });
    }
  }
};

// @desc    Download all files for a registration as ZIP
// @route   GET /api/files/download-all/:registrationId
// @access  Private/Admin
const downloadAllFiles = async (req, res) => {
  try {
    const { registrationId } = req.params;
    
    console.log(`📦 Download all files request - Registration: ${registrationId}`);

    // Find registration
    const registration = await Registration.findById(registrationId);
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    // Collect file information
    const filesToZip = [];
    const fileTypes = [
      { key: 'aadharFile', name: 'aadhar' },
      { key: 'signatureFile', name: 'signature' }
    ];

    for (const fileType of fileTypes) {
      const fileInfo = registration.files[fileType.key];
      if (fileInfo && fileInfo.path && await fs.pathExists(fileInfo.path)) {
        filesToZip.push({
          path: fileInfo.path,
          name: `${fileType.name}_${fileInfo.originalName}`,
          originalName: fileInfo.originalName
        });
      }
    }

    if (filesToZip.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No files found for this registration'
      });
    }

    // Create ZIP filename
    const zipFilename = `registration_${registrationId}_${registration.firstName}_${registration.lastName}_files.zip`;
    
    // Set response headers
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${zipFilename}"`,
      'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    // Create archiver instance
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    // Handle archiver errors
    archive.on('error', (error) => {
      console.error('❌ Archive error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Error creating ZIP file'
        });
      }
    });

    // Handle archiver warnings
    archive.on('warning', (warning) => {
      console.warn('⚠️ Archive warning:', warning);
    });

    // Pipe archive data to response
    archive.pipe(res);

    // Add files to archive
    console.log(`📦 Adding ${filesToZip.length} files to ZIP...`);
    
    for (const file of filesToZip) {
      try {
        const stream = fs.createReadStream(file.path);
        archive.append(stream, { name: file.name });
        console.log(`  ✅ Added: ${file.name}`);
      } catch (fileError) {
        console.error(`❌ Error adding file ${file.name}:`, fileError);
        // Continue with other files
      }
    }

    // Add registration info as text file
    const registrationInfo = `
Registration Information
========================
ID: ${registration._id}
Name: ${registration.fullName}
Email: ${registration.email}
Phone: ${registration.phone}
Course: ${registration.courseName}
Status: ${registration.status}
Date of Birth: ${registration.dateOfBirth?.toDateString()}
Address: ${registration.address}, ${registration.city}, ${registration.state} - ${registration.pincode}
Aadhaar Number: ${registration.formattedAadhar}
Submitted At: ${registration.submittedAt?.toLocaleString()}
${registration.reviewedAt ? `Reviewed At: ${registration.reviewedAt.toLocaleString()}` : ''}
${registration.reviewedBy ? `Reviewed By: ${registration.reviewedBy}` : ''}
${registration.notes ? `Notes: ${registration.notes}` : ''}
`;

    archive.append(registrationInfo, { name: 'registration_info.txt' });

    // Finalize the archive
    await archive.finalize();
    
    console.log(`✅ ZIP file created successfully: ${zipFilename}`);

  } catch (error) {
    console.error('❌ Download all files error:', error);

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid registration ID format'
      });
    }

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to create ZIP file',
        ...(process.env.NODE_ENV === 'development' && { error: error.message })
      });
    }
  }
};

// @desc    View file (stream for preview)
// @route   GET /api/files/view/:registrationId/:fileType
// @access  Private/Admin
const viewFile = async (req, res) => {
  try {
    const { registrationId, fileType } = req.params;

    console.log(`👁️ View file request - Registration: ${registrationId}, File: ${fileType}`);

    // Validate file type
    const allowedFileTypes = ['aadhar', 'signature'];
    if (!allowedFileTypes.includes(fileType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Must be "aadhar" or "signature"',
      });
    }

    // Find registration
    const registration = await Registration.findById(registrationId);
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: "Registration not found",
      });
    }

    // Get file info
    const fileField = fileType === "aadhar" ? "aadharFile" : "signatureFile";
    const fileInfo = registration.files[fileField];

    if (!fileInfo || !fileInfo.filename) {
      return res.status(404).json({
        success: false,
        message: `${fileType} file not found`,
      });
    }

    // Map file type to actual folder name
    const folderName = fileType === "aadhar" ? "aadhar" : "signatures";

    // Build URL dynamically
    const backendUrl = `${req.protocol}://${req.get("host")}`;
    const fileUrl = `${backendUrl}/uploads/${folderName}/${fileInfo.filename}`;

    console.log(`✅ File URL generated: ${fileUrl}`);

    return res.status(200).json({
      success: true,
      fileType,
      fileUrl,
    });
  } catch (error) {
    console.error("❌ View file error:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid registration ID format",
      });
    }

    return res.status(500).json({
      success: false,
      message: "File URL generation failed",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

// @desc    Get file information
// @route   GET /api/files/info/:registrationId/:fileType
// @access  Private/Admin
const getFileInfo = async (req, res) => {
  try {
    const { registrationId, fileType } = req.params;
    
    console.log(`ℹ️ File info request - Registration: ${registrationId}, File: ${fileType}`);

    // Validate file type
    const allowedFileTypes = ['aadhar', 'signature'];
    if (!allowedFileTypes.includes(fileType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Must be "aadhar" or "signature"'
      });
    }

    // Find registration
    const registration = await Registration.findById(registrationId);
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    // Get file info
    const fileField = fileType === 'aadhar' ? 'aadharFile' : 'signatureFile';
    const fileInfo = registration.files[fileField];
    
    if (!fileInfo) {
      return res.status(404).json({
        success: false,
        message: `${fileType} file not found`
      });
    }

    // Check if file exists on filesystem
    const fileExists = fileInfo.path ? await fs.pathExists(path.resolve(fileInfo.path)) : false;
    
    let fileStats = null;
    if (fileExists && fileInfo.path) {
      try {
        fileStats = await fs.stat(path.resolve(fileInfo.path));
      } catch (statError) {
        console.error('❌ Error getting file stats:', statError);
      }
    }

    console.log(`✅ File info retrieved for: ${fileType}`);

    res.json({
      success: true,
      data: {
        originalName: fileInfo.originalName,
        filename: fileInfo.filename,
        size: fileInfo.size,
        mimeType: fileInfo.mimeType,
        uploadedAt: fileInfo.uploadedAt,
        exists: fileExists,
        actualSize: fileStats ? fileStats.size : null,
        lastModified: fileStats ? fileStats.mtime : null,
        registrationInfo: {
          id: registration._id,
          name: registration.fullName,
          email: registration.email,
          status: registration.status
        }
      }
    });

  } catch (error) {
    console.error('❌ Get file info error:', error);

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid registration ID format'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to get file information',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Delete file
// @route   DELETE /api/files/:registrationId/:fileType
// @access  Private/Admin
const deleteFile = async (req, res) => {
  try {
    const { registrationId, fileType } = req.params;
    
    console.log(`🗑️ Delete file request - Registration: ${registrationId}, File: ${fileType}`);

    // Validate file type
    const allowedFileTypes = ['aadhar', 'signature'];
    if (!allowedFileTypes.includes(fileType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Must be "aadhar" or "signature"'
      });
    }

    // Find registration
    const registration = await Registration.findById(registrationId);
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    // Get file info
    const fileField = fileType === 'aadhar' ? 'aadharFile' : 'signatureFile';
    const fileInfo = registration.files[fileField];
    
    if (!fileInfo) {
      return res.status(404).json({
        success: false,
        message: `${fileType} file not found in database`
      });
    }

    // Delete file from filesystem if it exists
    if (fileInfo.path) {
      const filePath = path.resolve(fileInfo.path);
      try {
        if (await fs.pathExists(filePath)) {
          await fs.unlink(filePath);
          console.log(`✅ Deleted file from filesystem: ${filePath}`);
        } else {
          console.log(`⚠️ File not found on filesystem: ${filePath}`);
        }
      } catch (fileError) {
        console.error(`❌ Error deleting file from filesystem:`, fileError);
        // Continue with database cleanup even if file deletion fails
      }
    }

    // Remove file info from database
    registration.files[fileField] = undefined;
    await registration.save();

    console.log(`✅ File deleted successfully: ${fileType}`);

    res.json({
      success: true,
      message: `${fileType} file deleted successfully`
    });

  } catch (error) {
    console.error('❌ Delete file error:', error);

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid registration ID format'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to delete file',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get storage statistics
// @route   GET /api/files/stats
// @access  Private/Admin
const getStorageStats = async (req, res) => {
  try {
    console.log('📊 Fetching storage statistics...');

    // Get all registrations with files
    const registrations = await Registration.find({
      $or: [
        { 'files.aadharFile': { $exists: true } },
        { 'files.signatureFile': { $exists: true } }
      ]
    }).select('files');

    let totalFiles = 0;
    let totalSize = 0;
    let aadharFiles = 0;
    let signatureFiles = 0;
    let aadharSize = 0;
    let signatureSize = 0;
    let orphanedFiles = 0;

    const uploadsPath = process.env.UPLOAD_PATH || './uploads';
    
    for (const registration of registrations) {
      // Check Aadhaar files
      if (registration.files.aadharFile) {
        aadharFiles++;
        totalFiles++;
        const size = registration.files.aadharFile.size || 0;
        aadharSize += size;
        totalSize += size;

        // Check if file exists
        if (registration.files.aadharFile.path) {
          const exists = await fs.pathExists(path.resolve(registration.files.aadharFile.path));
          if (!exists) {
            orphanedFiles++;
          }
        }
      }

      // Check signature files
      if (registration.files.signatureFile) {
        signatureFiles++;
        totalFiles++;
        const size = registration.files.signatureFile.size || 0;
        signatureSize += size;
        totalSize += size;

        // Check if file exists
        if (registration.files.signatureFile.path) {
          const exists = await fs.pathExists(path.resolve(registration.files.signatureFile.path));
          if (!exists) {
            orphanedFiles++;
          }
        }
      }
    }

    // Get disk usage for uploads directory
    let diskUsage = null;
    try {
      if (await fs.pathExists(uploadsPath)) {
        const stats = await fs.stat(uploadsPath);
        diskUsage = {
          path: uploadsPath,
          created: stats.birthtime,
          modified: stats.mtime
        };
      }
    } catch (diskError) {
      console.error('❌ Error getting disk usage:', diskError);
    }

    const stats = {
      totalFiles,
      totalSize,
      totalSizeMB: Math.round((totalSize / 1024 / 1024) * 100) / 100,
      fileTypes: {
        aadhar: {
          count: aadharFiles,
          size: aadharSize,
          sizeMB: Math.round((aadharSize / 1024 / 1024) * 100) / 100
        },
        signature: {
          count: signatureFiles,
          size: signatureSize,
          sizeMB: Math.round((signatureSize / 1024 / 1024) * 100) / 100
        }
      },
      orphanedFiles,
      diskUsage,
      averageFileSize: totalFiles > 0 ? Math.round(totalSize / totalFiles) : 0
    };

    console.log('✅ Storage statistics compiled successfully');

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('❌ Error fetching storage statistics:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch storage statistics',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

module.exports = {
  downloadFile,
  downloadAllFiles,
  viewFile,
  getFileInfo,
  deleteFile,
  getStorageStats
};