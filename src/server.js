const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./config/db');
require('dotenv').config();

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure upload directories exist
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const secureUploadDir = path.join(uploadDir, 'secure');
if (!fs.existsSync(secureUploadDir)) {
  fs.mkdirSync(secureUploadDir, { recursive: true });
}

// Serve uploaded files statically (only public uploads!)
app.use('/uploads', express.static(uploadDir));

// Routes
const authRoutes = require('./routes/authRoutes');
const reportRoutes = require('./routes/reportRoutes');
const { authMiddleware } = require('./middleware/auth');

const campaignRoutes = require('./routes/campaignRoutes');
const taskRoutes = require('./routes/taskRoutes');
const alertRoutes = require('./routes/alertRoutes');
const researcherRoutes = require('./routes/researcherRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const authorityRoutes = require('./routes/authorityRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/researcher', researcherRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/authority', authorityRoutes);

// Dashboard stats endpoint (Authority & General Stats)
app.get('/api/stats', authMiddleware, async (req, res) => {
  try {
    const reportsCount = await db.query('SELECT COUNT(*) FROM pollution_reports');
    const verifiedCount = await db.query("SELECT COUNT(*) FROM pollution_reports WHERE status = 'Verified'");
    const completedCount = await db.query("SELECT COUNT(*) FROM pollution_reports WHERE status = 'Completed'");
    const campaignsCount = await db.query("SELECT COUNT(*) FROM cleanup_campaigns WHERE status IN ('Upcoming', 'Ongoing')");
    const volunteersCount = await db.query("SELECT COUNT(*) FROM users WHERE role = 'Volunteer'");
    
    // User-specific stats for dashboard activities
    const userActiveCount = await db.query("SELECT COUNT(*)::int FROM pollution_reports WHERE reported_by = $1 AND status != 'Completed'", [req.user.user_id]);
    const userResolvedCount = await db.query("SELECT COUNT(*)::int FROM pollution_reports WHERE reported_by = $1 AND status = 'Completed'", [req.user.user_id]);
    
    // Fetch user district for nearby reports count
    const userDistrictResult = await db.query("SELECT district FROM users WHERE user_id = $1", [req.user.user_id]);
    const districtName = userDistrictResult.rows[0]?.district || 'Kochi';
    const userNearbyCount = await db.query("SELECT COUNT(*)::int FROM pollution_reports WHERE location_name ILIKE $1", [`%${districtName}%`]);
    
    // Fetch campaigns joined count and their IDs
    const userCampaignsJoinedCount = await db.query("SELECT COUNT(*)::int FROM campaign_volunteers WHERE volunteer_id = $1", [req.user.user_id]);
    const userCampaignsJoinedIds = await db.query("SELECT campaign_id FROM campaign_volunteers WHERE volunteer_id = $1", [req.user.user_id]);
    const joinedCampaignIds = userCampaignsJoinedIds.rows.map(row => row.campaign_id);

    // Reports grouped by waste type (for pie chart)
    const wasteTypeStats = await db.query(`
      SELECT COALESCE(waste_type, 'Other') as name, COUNT(*)::int as value 
      FROM pollution_reports 
      GROUP BY waste_type
    `);

    // Reports grouped by severity (for bar chart)
    const severityStats = await db.query(`
      SELECT COALESCE(severity, 'Medium') as name, COUNT(*)::int as value 
      FROM pollution_reports 
      GROUP BY severity
    `);

    // Reports grouped by status
    const statusStats = await db.query(`
      SELECT status as name, COUNT(*)::int as value 
      FROM pollution_reports 
      GROUP BY status
    `);

    res.json({
      summary: {
        totalReports: parseInt(reportsCount.rows[0].count),
        verifiedReports: parseInt(verifiedCount.rows[0].count),
        completedReports: parseInt(completedCount.rows[0].count),
        activeCampaigns: parseInt(campaignsCount.rows[0].count),
        registeredVolunteers: parseInt(volunteersCount.rows[0].count),
      },
      userStats: {
        activeReports: userActiveCount.rows[0].count,
        resolvedReports: userResolvedCount.rows[0].count,
        nearbyReports: userNearbyCount.rows[0].count,
        campaignsJoined: userCampaignsJoinedCount.rows[0].count,
        joinedCampaignIds: joinedCampaignIds
      },
      wasteTypes: wasteTypeStats.rows,
      severity: severityStats.rows,
      status: statusStats.rows,
    });
  } catch (error) {
    console.error('Stats Error:', error);
    res.status(500).json({ error: 'Server error retrieving statistics.' });
  }
});

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the TerraMarine API Server (Phase 1)' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
