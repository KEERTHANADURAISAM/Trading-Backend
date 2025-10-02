const Registration = require('../models/Registration');
const path = require('path');
const fs = require('fs-extra');

// @desc    Get dashboard overview
// @route   GET /api/admin/dashboard
// @access  Private/Admin
const getDashboardOverview = async (req, res) => {
  try {
    console.log('📊 Fetching dashboard overview...');

    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Parallel queries for performance
    const [
      totalRegistrations,
      todayRegistrations,
      yesterdayRegistrations,
      weekRegistrations,
      monthRegistrations,
      lastMonthRegistrations,
      statusDistribution,
      courseDistribution,
      recentRegistrations,
      pendingRegistrations
    ] = await Promise.all([
      // Total registrations
      Registration.countDocuments(),
      
      // Today's registrations
      Registration.countDocuments({
        submittedAt: { $gte: todayStart }
      }),
      
      // Yesterday's registrations
      Registration.countDocuments({
        submittedAt: { 
          $gte: yesterdayStart, 
          $lt: todayStart 
        }
      }),
      
      // This week's registrations
      Registration.countDocuments({
        submittedAt: { $gte: weekStart }
      }),
      
      // This month's registrations
      Registration.countDocuments({
        submittedAt: { $gte: monthStart }
      }),
      
      // Last month's registrations
      Registration.countDocuments({
        submittedAt: { 
          $gte: lastMonthStart, 
          $lt: lastMonthEnd 
        }
      }),
      
      // Status distribution
      Registration.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      
      // Course distribution
      Registration.aggregate([
        {
          $group: {
            _id: '$courseName',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      
      // Recent registrations
      Registration.find()
        .sort({ submittedAt: -1 })
        .limit(10)
        .select('firstName lastName email courseName status submittedAt'),
      
      // Pending registrations count
      Registration.countDocuments({ status: 'pending' })
    ]);

    // Calculate growth percentages
    const todayGrowth = yesterdayRegistrations === 0 
      ? (todayRegistrations > 0 ? 100 : 0)
      : ((todayRegistrations - yesterdayRegistrations) / yesterdayRegistrations * 100);
    
    const monthGrowth = lastMonthRegistrations === 0 
      ? (monthRegistrations > 0 ? 100 : 0)
      : ((monthRegistrations - lastMonthRegistrations) / lastMonthRegistrations * 100);

    // Get file statistics
    const uploadsPath = process.env.UPLOAD_PATH || './uploads';
    let totalFiles = 0;
    let totalFileSize = 0;

    try {
      const allRegistrations = await Registration.find({
        $or: [
          { 'files.aadharFile': { $exists: true } },
          { 'files.signatureFile': { $exists: true } }
        ]
      }).select('files');

      allRegistrations.forEach(reg => {
        if (reg.files.aadharFile) {
          totalFiles++;
          totalFileSize += reg.files.aadharFile.size || 0;
        }
        if (reg.files.signatureFile) {
          totalFiles++;
          totalFileSize += reg.files.signatureFile.size || 0;
        }
      });
    } catch (fileError) {
      console.error('Error calculating file stats:', fileError);
    }

    // Build response
    const overview = {
      registrations: {
        total: totalRegistrations,
        today: todayRegistrations,
        yesterday: yesterdayRegistrations,
        week: weekRegistrations,
        month: monthRegistrations,
        growth: {
          today: Math.round(todayGrowth * 100) / 100,
          month: Math.round(monthGrowth * 100) / 100
        }
      },
      status: statusDistribution.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      courses: courseDistribution,
      files: {
        total: totalFiles,
        totalSize: totalFileSize,
        totalSizeMB: Math.round((totalFileSize / 1024 / 1024) * 100) / 100
      },
      pending: pendingRegistrations,
      recent: recentRegistrations
    };

    console.log('✅ Dashboard overview compiled successfully');

    res.json({
      success: true,
      data: overview
    });

  } catch (error) {
    console.error('❌ Error fetching dashboard overview:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard overview',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
}; // FIXED: Added missing closing brace and semicolon

// @desc    Get registration analytics
// @route   GET /api/admin/analytics/registrations
// @access  Private/Admin
const getRegistrationAnalytics = async (req, res) => {
  try {
    console.log('📊 Fetching registration analytics...');

    const { period = 'week' } = req.query;
    
    let dateRange;
    const now = new Date();
    
    switch (period) {
      case 'today':
        dateRange = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'week':
        dateRange = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        dateRange = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        dateRange = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        dateRange = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Daily registration counts
    const dailyRegistrations = await Registration.aggregate([
      {
        $match: {
          submittedAt: { $gte: dateRange }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$submittedAt' },
            month: { $month: '$submittedAt' },
            day: { $dayOfMonth: '$submittedAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    // Status distribution over time
    const statusTrends = await Registration.aggregate([
      {
        $match: {
          submittedAt: { $gte: dateRange }
        }
      },
      {
        $group: {
          _id: {
            status: '$status',
            date: {
              year: { $year: '$submittedAt' },
              month: { $month: '$submittedAt' },
              day: { $dayOfMonth: '$submittedAt' }
            }
          },
          count: { $sum: 1 }
        }
      }
    ]);

    // Course popularity
    const coursePopularity = await Registration.aggregate([
      {
        $match: {
          submittedAt: { $gte: dateRange }
        }
      },
      {
        $group: {
          _id: '$courseName',
          count: { $sum: 1 },
          avgAge: { 
            $avg: {
              $divide: [
                { $subtract: [new Date(), '$dateOfBirth'] },
                365.25 * 24 * 60 * 60 * 1000
              ]
            }
          }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 10
      }
    ]);

    console.log('✅ Registration analytics compiled');

    res.json({
      success: true,
      data: {
        period,
        dailyRegistrations,
        statusTrends,
        coursePopularity,
        summary: {
          totalInPeriod: dailyRegistrations.reduce((sum, day) => sum + day.count, 0),
          averagePerDay: dailyRegistrations.length > 0 
            ? Math.round(dailyRegistrations.reduce((sum, day) => sum + day.count, 0) / dailyRegistrations.length * 100) / 100 
            : 0
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching registration analytics:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Export registrations data
// @route   GET /api/admin/export/registrations
// @access  Private/Admin
const exportRegistrations = async (req, res) => {
  try {
    console.log('📤 Exporting registrations...');

    const { format = 'json', status, course, startDate, endDate } = req.query;

    // Build filter
    const filter = {};
    
    if (status && status !== 'all') {
      filter.status = status;
    }
    
    if (course) {
      filter.courseName = { $regex: course, $options: 'i' };
    }
    
    if (startDate || endDate) {
      filter.submittedAt = {};
      if (startDate) filter.submittedAt.$gte = new Date(startDate);
      if (endDate) filter.submittedAt.$lte = new Date(endDate);
    }

    // Fetch registrations
    const registrations = await Registration.find(filter)
      .select('-files.aadharFile.path -files.signatureFile.path') // Exclude sensitive paths
      .sort({ submittedAt: -1 });

    if (format === 'csv') {
      // Generate CSV
      const csvHeaders = [
        'ID', 'Name', 'Email', 'Phone', 'Course', 'Status', 
        'Age', 'City', 'State', 'Submitted Date', 'Reviewed Date'
      ];

      const csvRows = registrations.map(reg => [
        reg._id,
        `${reg.firstName} ${reg.lastName}`,
        reg.email,
        reg.phone,
        reg.courseName,
        reg.status,
        reg.age || 'N/A',
        reg.city,
        reg.state,
        reg.submittedAt?.toISOString() || '',
        reg.reviewedAt?.toISOString() || ''
      ]);

      const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="registrations_${Date.now()}.csv"`);
      res.send(csvContent);

    } else {
      // JSON format
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="registrations_${Date.now()}.json"`);
      
      res.json({
        success: true,
        exportedAt: new Date().toISOString(),
        filters: { status, course, startDate, endDate },
        total: registrations.length,
        data: registrations
      });
    }

    console.log(`✅ Exported ${registrations.length} registrations as ${format.toUpperCase()}`);

  } catch (error) {
    console.error('❌ Export error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Export failed',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

module.exports = {
  getDashboardOverview,
  getRegistrationAnalytics,
  exportRegistrations
};