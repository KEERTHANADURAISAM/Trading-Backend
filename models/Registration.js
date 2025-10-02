const mongoose = require('mongoose');

// Registration Schema
const registrationSchema = new mongoose.Schema({
  // Personal Information
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    minlength: [2, 'First name must be at least 2 characters'],
    maxlength: [50, 'First name cannot exceed 50 characters'],
    match: [/^[a-zA-Z\s]+$/, 'First name can only contain letters and spaces']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    minlength: [2, 'Last name must be at least 2 characters'],
    maxlength: [50, 'Last name cannot exceed 50 characters'],
    match: [/^[a-zA-Z\s]+$/, 'Last name can only contain letters and spaces']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address'],
    index: true
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    match: [/^[6789]\d{9}$/, 'Phone number must be 10 digits starting with 6, 7, 8, or 9'],
    index: true
  },
  dateOfBirth: {
    type: Date,
    required: [true, 'Date of birth is required'],
    validate: {
      validator: function(value) {
        const today = new Date();
        const birthDate = new Date(value);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        
        return age >= 18 && age <= 100 && birthDate <= today;
      },
      message: 'Age must be between 18 and 100 years, and date cannot be in the future'
    }
  },
  
  // Address Information
  address: {
    type: String,
    required: [true, 'Address is required'],
    trim: true,
    minlength: [10, 'Address must be at least 10 characters'],
    maxlength: [200, 'Address cannot exceed 200 characters']
  },
  city: {
    type: String,
    required: [true, 'City is required'],
    trim: true,
    minlength: [2, 'City must be at least 2 characters'],
    maxlength: [50, 'City cannot exceed 50 characters'],
    match: [/^[a-zA-Z\s]+$/, 'City can only contain letters and spaces']
  },
  state: {
    type: String,
    required: [true, 'State is required'],
    trim: true,
    minlength: [2, 'State must be at least 2 characters'],
    maxlength: [50, 'State cannot exceed 50 characters'],
    match: [/^[a-zA-Z\s]+$/, 'State can only contain letters and spaces']
  },
  pincode: {
    type: String,
    required: [true, 'Pincode is required'],
    match: [/^[1-9]\d{5}$/, 'Pincode must be 6 digits and cannot start with 0']
  },
  
  // Identity Information
  aadharNumber: {
    type: String,
    required: [true, 'Aadhaar number is required'],
    unique: true,
    validate: {
      validator: function(value) {
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
      message: 'Please enter a valid 12-digit Aadhaar number'
    },
    index: true
  },
  
  // Course Information
  courseName: {
    type: String,
    required: [true, 'Course name is required'],
    trim: true,
    maxlength: [100, 'Course name cannot exceed 100 characters']
  },
  
  // File Information
  files: {
    aadharFile: {
      originalName: { type: String, required: true },
      filename: { type: String, required: true },
      path: { type: String, required: true },
      size: { type: Number, required: true },
      mimeType: { type: String, required: true },
      uploadedAt: { type: Date, default: Date.now }
    },
    signatureFile: {
      originalName: { type: String, required: true },
      filename: { type: String, required: true },
      path: { type: String, required: true },
      size: { type: Number, required: true },
      mimeType: { type: String, required: true },
      uploadedAt: { type: Date, default: Date.now }
    }
  },
  
  // Agreement flags
  agreeTerms: {
    type: Boolean,
    required: [true, 'You must accept the terms and conditions'],
    validate: {
      validator: function(value) {
        return value === true;
      },
      message: 'You must accept the terms and conditions'
    }
  },
  agreeMarketing: {
    type: Boolean,
    default: false
  },
  
  // Status and Metadata
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'under_review'],
    default: 'pending'
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  reviewedAt: {
    type: Date
  },
  reviewedBy: {
    type: String
  },
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  
  // System fields
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      // Don't return sensitive file paths in API responses
      if (ret.files) {
        if (ret.files.aadharFile) {
          ret.files.aadharFile = {
            originalName: ret.files.aadharFile.originalName,
            size: ret.files.aadharFile.size,
            mimeType: ret.files.aadharFile.mimeType,
            uploadedAt: ret.files.aadharFile.uploadedAt
          };
        }
        if (ret.files.signatureFile) {
          ret.files.signatureFile = {
            originalName: ret.files.signatureFile.originalName,
            size: ret.files.signatureFile.size,
            mimeType: ret.files.signatureFile.mimeType,
            uploadedAt: ret.files.signatureFile.uploadedAt
          };
        }
      }
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Virtual for full name
registrationSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for age calculation
registrationSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
});

// Virtual for formatted Aadhaar number
registrationSchema.virtual('formattedAadhar').get(function() {
  if (!this.aadharNumber) return null;
  const clean = this.aadharNumber.replace(/\D/g, '');
  return clean.replace(/(\d{4})(?=\d)/g, '$1 ');
});

// Index for efficient queries
registrationSchema.index({ email: 1, phone: 1 });
registrationSchema.index({ status: 1, submittedAt: -1 });
registrationSchema.index({ courseName: 1, submittedAt: -1 });

// Pre-save middleware
registrationSchema.pre('save', function(next) {
  // Clean and format Aadhaar number
  if (this.aadharNumber) {
    this.aadharNumber = this.aadharNumber.replace(/\D/g, '');
  }
  
  // Convert email to lowercase
  if (this.email) {
    this.email = this.email.toLowerCase().trim();
  }
  
  // Clean phone number
  if (this.phone) {
    this.phone = this.phone.replace(/\D/g, '');
  }
  
  next();
});

// Static methods
registrationSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase().trim() });
};

registrationSchema.statics.findByPhone = function(phone) {
  const cleanPhone = phone.replace(/\D/g, '');
  return this.findOne({ phone: cleanPhone });
};

registrationSchema.statics.findByAadhar = function(aadhar) {
  const cleanAadhar = aadhar.replace(/\D/g, '');
  return this.findOne({ aadharNumber: cleanAadhar });
};

registrationSchema.statics.getRegistrationStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$count' },
        stats: {
          $push: {
            status: '$_id',
            count: '$count'
          }
        }
      }
    }
  ]);
};

// Instance methods
registrationSchema.methods.approve = function(reviewedBy, notes) {
  this.status = 'approved';
  this.reviewedAt = new Date();
  this.reviewedBy = reviewedBy;
  if (notes) this.notes = notes;
  return this.save();
};

registrationSchema.methods.reject = function(reviewedBy, notes) {
  this.status = 'rejected';
  this.reviewedAt = new Date();
  this.reviewedBy = reviewedBy;
  if (notes) this.notes = notes;
  return this.save();
};

registrationSchema.methods.setUnderReview = function(reviewedBy, notes) {
  this.status = 'under_review';
  this.reviewedAt = new Date();
  this.reviewedBy = reviewedBy;
  if (notes) this.notes = notes;
  return this.save();
};

// Export the model
module.exports = mongoose.model('Registration', registrationSchema);