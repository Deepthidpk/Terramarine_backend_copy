const db = require('../config/db');
const sendEmail = require('../utils/sendEmail');

// Create Pollution or Emergency Report
exports.createReport = async (req, res) => {
  const { title, description, report_category, latitude, longitude, location_name, waste_type, severity } = req.body;
  const reported_by = req.user.user_id;

  if (!title || !latitude || !longitude || !location_name) {
    return res.status(400).json({ error: 'Title, latitude, longitude, and beach / location name are required.' });
  }

  if (title.trim().length < 3 || title.length > 150) {
    return res.status(400).json({ error: 'Title must be between 3 and 150 characters.' });
  }

  if (location_name.trim().length < 2 || location_name.length > 150) {
    return res.status(400).json({ error: 'Beach / Location name must be between 2 and 150 characters.' });
  }

  const latNum = parseFloat(latitude);
  const lngNum = parseFloat(longitude);

  if (isNaN(latNum) || latNum < -90 || latNum > 90) {
    return res.status(400).json({ error: 'Please provide a valid latitude between -90 and 90.' });
  }

  if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
    return res.status(400).json({ error: 'Please provide a valid longitude between -180 and 180.' });
  }

  // Handle uploaded file path or default placeholder
  let imageUrl = null;
  if (req.file) {
    imageUrl = `/uploads/${req.file.filename}`;
  } else if (req.body.image_url) {
    imageUrl = req.body.image_url;
  } else {
    imageUrl = 'https://images.unsplash.com/photo-1618477388954-7852f32655ec'; // Default sample evidence
  }

  try {
    const insertQuery = `
      INSERT INTO pollution_reports 
      (reported_by, report_category, title, description, image_url, latitude, longitude, location_name, waste_type, severity, status) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Pending') 
      RETURNING *
    `;
    const values = [
      reported_by,
      report_category || 'Pollution',
      title.trim(),
      description ? description.trim() : null,
      imageUrl,
      latNum,
      lngNum,
      location_name.trim(),
      waste_type || 'Plastic',
      severity || 'Medium'
    ];

    const result = await db.query(insertQuery, values);
    const newReport = result.rows[0];

    // Log initial status tracking record
    await db.query(
      `INSERT INTO report_updates (report_id, updated_by, old_status, new_status, remarks)
       VALUES ($1, $2, NULL, 'Pending', 'Report submitted by citizen and pending authority verification.')`,
      [newReport.report_id, reported_by]
    );

    // In-app Notification to Citizen Reporter
    const notifMessage = `Your pollution report "${newReport.title}" has been received and logged.`;
    await db.query(
      `INSERT INTO notifications (user_id, title, message, reference_type, reference_id)
       VALUES ($1, 'Report Submitted', $2, 'PollutionReport', $3)`,
      [reported_by, notifMessage, newReport.report_id]
    );

    // Notify all Municipal Authorities & Admins about the new pollution report
    const categoryTag = (newReport.report_category || 'Pollution').toUpperCase();
    const authorityMsg = `[${categoryTag}] New pollution report "${newReport.title}" (${newReport.severity || 'Medium'} Severity, ${newReport.waste_type || 'Waste'}) was submitted at ${newReport.location_name || 'coastal location'}.`;
    await db.query(
      `INSERT INTO notifications (user_id, title, message, reference_type, reference_id)
       SELECT user_id, 'New Pollution Report Submitted', $1, 'PollutionReport', $2
       FROM users WHERE role IN ('Authority', 'Admin')`,
      [authorityMsg, newReport.report_id]
    );

    // Dispatch Email Notification to Citizen
    if (req.user.email) {
      sendEmail({
        to: req.user.email,
        subject: `TerraMarine - Pollution Report Submitted: ${newReport.title}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #0f172a;">
            <h2 style="color: #0284c7;">🌊 TerraMarine Coastal Support</h2>
            <h3>Pollution Report Successfully Logged</h3>
            <p>Dear <strong>${req.user.full_name}</strong>,</p>
            <p>Thank you for helping protect our oceans and coasts. Your report has been submitted to local environmental authorities.</p>
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #0284c7; margin: 15px 0;">
              <p style="margin: 4px 0;"><strong>Report Title:</strong> ${newReport.title}</p>
              <p style="margin: 4px 0;"><strong>Location:</strong> ${newReport.location_name}</p>
              <p style="margin: 4px 0;"><strong>GPS Coordinates:</strong> ${latNum.toFixed(4)}, ${lngNum.toFixed(4)}</p>
              <p style="margin: 4px 0;"><strong>Status:</strong> <span style="color: #b45309; font-weight: bold;">Pending Verification</span></p>
            </div>
            <p>You can track complaint progress live in your TerraMarine account dashboard.</p>
          </div>
        `
      }).catch(err => console.error('Email dispatch error:', err.message));
    }

    res.status(201).json({ report: newReport });
  } catch (error) {
    console.error('Create Report Error:', error);
    res.status(500).json({ error: 'Server error during report creation.' });
  }
};

// Get All Reports (with optional filter parameters)
exports.getReports = async (req, res) => {
  const { status, category, severity } = req.query;
  
  let queryText = `
    SELECT r.*, u.full_name as reporter_name, u.role as reporter_role
    FROM pollution_reports r
    JOIN users u ON r.reported_by = u.user_id
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    params.push(status);
    queryText += ` AND r.status = $${params.length}`;
  }
  if (category) {
    params.push(category);
    queryText += ` AND r.report_category = $${params.length}`;
  }
  if (severity) {
    params.push(severity);
    queryText += ` AND r.severity = $${params.length}`;
  }

  queryText += ' ORDER BY r.reported_at DESC';

  try {
    const result = await db.query(queryText, params);
    res.json({ reports: result.rows });
  } catch (error) {
    console.error('Get Reports Error:', error);
    res.status(500).json({ error: 'Server error retrieving reports.' });
  }
};

// Get Specific Report with Timeline Updates
exports.getReportById = async (req, res) => {
  const { id } = req.params;

  try {
    const reportQuery = `
      SELECT r.*, u.full_name as reporter_name, u.email as reporter_email, u.phone as reporter_phone
      FROM pollution_reports r
      JOIN users u ON r.reported_by = u.user_id
      WHERE r.report_id = $1
    `;
    const reportResult = await db.query(reportQuery, [id]);

    if (reportResult.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found.' });
    }

    // Fetch update timeline history
    const updatesResult = await db.query(
      `SELECT u.*, us.full_name as updated_by_name 
       FROM report_updates u 
       JOIN users us ON u.updated_by = us.user_id 
       WHERE u.report_id = $1 ORDER BY u.updated_at ASC`,
      [id]
    );

    res.json({ 
      report: reportResult.rows[0],
      updates: updatesResult.rows
    });
  } catch (error) {
    console.error('Get Report Details Error:', error);
    res.status(500).json({ error: 'Server error retrieving report details.' });
  }
};

// Verify Report (Authority only)
exports.verifyReport = async (req, res) => {
  const { id } = req.params;
  const { severity } = req.body;
  const updated_by = req.user.user_id;

  try {
    const reportResult = await db.query('SELECT r.*, u.email, u.full_name FROM pollution_reports r JOIN users u ON r.reported_by = u.user_id WHERE r.report_id = $1', [id]);
    if (reportResult.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found.' });
    }

    const report = reportResult.rows[0];
    const oldStatus = report.status;
    const newSeverity = severity || report.severity;

    // Update report
    const updateResult = await db.query(
      `UPDATE pollution_reports 
       SET status = 'Verified', severity = $1, verified_at = NOW() 
       WHERE report_id = $2 
       RETURNING *`,
      [newSeverity, id]
    );

    // Track status change
    await db.query(
      `INSERT INTO report_updates (report_id, updated_by, old_status, new_status, remarks) 
       VALUES ($1, $2, $3, 'Verified', $4)`,
      [id, updated_by, oldStatus, `Report verified by Authority with severity: ${newSeverity}`]
    );

    // In-app Notification
    const notifVerifiedMsg = `Authority verified your report: "${report.title}"`;
    await db.query(
      `INSERT INTO notifications (user_id, title, message, reference_type, reference_id)
       VALUES ($1, 'Report Verified', $2, 'PollutionReport', $3)`,
      [report.reported_by, notifVerifiedMsg, id]
    );

    // Dispatch Email Notification to Citizen
    if (report.email) {
      sendEmail({
        to: report.email,
        subject: `TerraMarine - Report Verified: ${report.title}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #0f172a;">
            <h2 style="color: #166534;">✓ Pollution Report Verified</h2>
            <p>Dear <strong>${report.full_name}</strong>,</p>
            <p>Your report titled <strong>"${report.title}"</strong> has been verified by coastal management authorities.</p>
            <p><strong>Status:</strong> <span style="color: #166534; font-weight: bold;">Verified</span></p>
            <p>A cleanup task will now be assigned to local volunteer teams.</p>
          </div>
        `
      }).catch(err => console.error('Email error:', err.message));
    }

    res.json({ report: updateResult.rows[0] });
  } catch (error) {
    console.error('Verify Report Error:', error);
    res.status(500).json({ error: 'Server error during report verification.' });
  }
};

// Update Report Status & Remarks
exports.updateReportStatus = async (req, res) => {
  const { id } = req.params;
  const { status, remarks } = req.body;
  const updated_by = req.user.user_id;

  if (!status) {
    return res.status(400).json({ error: 'Status is required.' });
  }

  try {
    const reportResult = await db.query('SELECT r.*, u.email, u.full_name FROM pollution_reports r JOIN users u ON r.reported_by = u.user_id WHERE r.report_id = $1', [id]);
    if (reportResult.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found.' });
    }

    const report = reportResult.rows[0];
    const oldStatus = report.status;

    let completedAtVal = null;
    if (status === 'Completed') {
      completedAtVal = new Date();
    }

    const updateQuery = `
      UPDATE pollution_reports 
      SET status = $1, completed_at = COALESCE($2, completed_at) 
      WHERE report_id = $3 
      RETURNING *
    `;
    const updateResult = await db.query(updateQuery, [status, completedAtVal, id]);

    // Insert audit update
    await db.query(
      `INSERT INTO report_updates (report_id, updated_by, old_status, new_status, remarks) 
       VALUES ($1, $2, $3, $4, $5)`,
      [id, updated_by, oldStatus, status, remarks || `Status updated from ${oldStatus} to ${status}`]
    );

    // In-app Notification
    const notifStatusMsg = `Your report "${report.title}" status is now ${status}`;
    await db.query(
      `INSERT INTO notifications (user_id, title, message, reference_type, reference_id)
       VALUES ($1, 'Report Status Updated', $2, 'PollutionReport', $3)`,
      [report.reported_by, notifStatusMsg, id]
    );

    // Dispatch Email Notification to Citizen
    if (report.email) {
      sendEmail({
        to: report.email,
        subject: `TerraMarine - Complaint Status Update: ${report.title}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #0f172a;">
            <h2 style="color: #0284c7;">🌊 TerraMarine Status Update</h2>
            <p>Dear <strong>${report.full_name}</strong>,</p>
            <p>Your report titled <strong>"${report.title}"</strong> has been updated to <strong>${status}</strong>.</p>
            ${remarks ? `<p><strong>Notes:</strong> ${remarks}</p>` : ''}
          </div>
        `
      }).catch(err => console.error('Email error:', err.message));
    }

    res.json({ report: updateResult.rows[0] });
  } catch (error) {
    console.error('Update Status Error:', error);
    res.status(500).json({ error: 'Server error updating status.' });
  }
};
