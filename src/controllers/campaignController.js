const db = require('../config/db');
const sendEmail = require('../utils/sendEmail');

// Create Campaign (NGO or Authority/Admin only)
exports.createCampaign = async (req, res) => {
  const { campaign_name, description, campaign_date, start_time, end_time, location, latitude, longitude, maximum_volunteers } = req.body;
  const created_by = req.user.user_id;

  if (!campaign_name || !campaign_date || !location) {
    return res.status(400).json({ error: 'Campaign name, date, and location are required.' });
  }

  try {
    const insertQuery = `
      INSERT INTO cleanup_campaigns 
      (created_by, campaign_name, description, campaign_date, start_time, end_time, location, latitude, longitude, maximum_volunteers, status) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Upcoming') 
      RETURNING *
    `;
    const values = [
      created_by,
      campaign_name,
      description || null,
      campaign_date,
      start_time || null,
      end_time || null,
      location,
      latitude ? parseFloat(latitude) : null,
      longitude ? parseFloat(longitude) : null,
      maximum_volunteers ? parseInt(maximum_volunteers) : null
    ];

    const result = await db.query(insertQuery, values);
    const newCampaign = result.rows[0];

    // Notify all Volunteers about the new campaign
    await db.query(
      `INSERT INTO notifications (user_id, title, message, reference_type, reference_id)
       SELECT user_id, 'New Cleanup Campaign: ' || $1, 'Join us on ' || $2 || ' at ' || $3, 'Campaign', $4
       FROM users WHERE role = 'Volunteer' OR role = 'Citizen'`,
      [campaign_name, campaign_date, location, newCampaign.campaign_id]
    );

    res.status(201).json({ campaign: newCampaign });
  } catch (error) {
    console.error('Create Campaign Error:', error);
    res.status(500).json({ error: 'Server error during campaign creation.' });
  }
};

// Get All Campaigns
exports.getCampaigns = async (req, res) => {
  const { status } = req.query;
  const user_id = req.user ? req.user.user_id : null;

  let queryText = `
    SELECT c.*, u.full_name as creator_name, u.organization_name,
      (SELECT COUNT(*)::int FROM campaign_volunteers cv WHERE cv.campaign_id = c.campaign_id) as volunteer_count
      ${user_id ? `, (SELECT COUNT(*)::int > 0 FROM campaign_volunteers cv2 WHERE cv2.campaign_id = c.campaign_id AND cv2.volunteer_id = $1) as is_joined` : ''}
    FROM cleanup_campaigns c
    JOIN users u ON c.created_by = u.user_id
    WHERE 1=1
  `;
  const params = user_id ? [user_id] : [];

  if (status) {
    params.push(status);
    queryText += ` AND c.status = $${params.length}`;
  }

  queryText += ' ORDER BY c.campaign_date DESC';

  try {
    const result = await db.query(queryText, params);
    res.json({ campaigns: result.rows });
  } catch (error) {
    console.error('Get Campaigns Error:', error);
    res.status(500).json({ error: 'Server error retrieving campaigns.' });
  }
};

// Get Campaign Details & Volunteers
exports.getCampaignById = async (req, res) => {
  const { id } = req.params;

  try {
    const campaignQuery = `
      SELECT c.*, u.full_name as creator_name, u.organization_name, u.email as creator_email
      FROM cleanup_campaigns c
      JOIN users u ON c.created_by = u.user_id
      WHERE c.campaign_id = $1
    `;
    const campaignResult = await db.query(campaignQuery, [id]);

    if (campaignResult.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found.' });
    }

    // Fetch registered volunteers
    const volunteersQuery = `
      SELECT cv.id as registration_id, cv.joined_date, cv.attendance, cv.certificate_status,
        u.user_id, u.full_name, u.email, u.phone, u.profile_image
      FROM campaign_volunteers cv
      JOIN users u ON cv.volunteer_id = u.user_id
      WHERE cv.campaign_id = $1
      ORDER BY cv.joined_date DESC
    `;
    const volunteersResult = await db.query(volunteersQuery, [id]);

    // Fetch associated tasks
    const tasksQuery = `
      SELECT t.*, r.title as report_title, r.latitude, r.longitude
      FROM cleanup_tasks t
      JOIN pollution_reports r ON t.report_id = r.report_id
      WHERE t.campaign_id = $1
    `;
    const tasksResult = await db.query(tasksQuery, [id]);

    res.json({
      campaign: campaignResult.rows[0],
      volunteers: volunteersResult.rows,
      tasks: tasksResult.rows
    });
  } catch (error) {
    console.error('Get Campaign Details Error:', error);
    res.status(500).json({ error: 'Server error retrieving campaign details.' });
  }
};

// Join a Campaign (Citizen/Volunteer)
exports.joinCampaign = async (req, res) => {
  const campaign_id = req.params.id;
  const volunteer_id = req.user.user_id;

  try {
    // Check if campaign exists and status is upcoming/ongoing
    const campaignResult = await db.query('SELECT status, maximum_volunteers FROM cleanup_campaigns WHERE campaign_id = $1', [campaign_id]);
    if (campaignResult.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found.' });
    }

    const campaign = campaignResult.rows[0];
    if (campaign.status === 'Completed' || campaign.status === 'Cancelled') {
      return res.status(400).json({ error: `Cannot join campaign since it is already ${campaign.status}.` });
    }

    // Check volunteer count limit
    if (campaign.maximum_volunteers) {
      const countResult = await db.query('SELECT COUNT(*) FROM campaign_volunteers WHERE campaign_id = $1', [campaign_id]);
      const currentVolunteers = parseInt(countResult.rows[0].count);
      if (currentVolunteers >= campaign.maximum_volunteers) {
        return res.status(400).json({ error: 'Campaign has reached its maximum volunteer capacity.' });
      }
    }

    // Check if already joined
    const checkResult = await db.query('SELECT id FROM campaign_volunteers WHERE campaign_id = $1 AND volunteer_id = $2', [campaign_id, volunteer_id]);
    if (checkResult.rows.length > 0) {
      return res.status(200).json({ message: 'You have already registered for this campaign.', is_joined: true });
    }

    // Insert volunteer record
    await db.query(
      'INSERT INTO campaign_volunteers (campaign_id, volunteer_id) VALUES ($1, $2)',
      [campaign_id, volunteer_id]
    );

    // In-app Notification
    await db.query(
      `INSERT INTO notifications (user_id, title, message, reference_type, reference_id)
       VALUES ($1, 'Campaign Registration Confirmed', 'You have successfully registered for the cleanup campaign drive.', 'CleanupCampaign', $2)`,
      [volunteer_id, campaign_id]
    );

    // Dispatch Email Notification
    if (req.user && req.user.email) {
      sendEmail({
        to: req.user.email,
        subject: `TerraMarine - Campaign Registration Confirmed`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #0f172a;">
            <h2 style="color: #0284c7;">🌊 TerraMarine Cleanup Registration</h2>
            <p>Dear <strong>${req.user.full_name}</strong>,</p>
            <p>Your registration for the coastal cleanup drive has been confirmed!</p>
            <p>Thank you for contributing to coastal ecosystem restoration.</p>
          </div>
        `
      }).catch(err => console.error('Email error:', err.message));
    }

    res.status(201).json({ message: 'Successfully registered for campaign.' });
  } catch (error) {
    console.error('Join Campaign Error:', error);
    res.status(500).json({ error: 'Server error registering for campaign.' });
  }
};

// Update Campaign Status
exports.updateCampaignStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status is required.' });
  }

  try {
    // Verify campaigner exists
    const campaignResult = await db.query('SELECT created_by, campaign_name FROM cleanup_campaigns WHERE campaign_id = $1', [id]);
    if (campaignResult.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found.' });
    }

    // Update status
    const updateResult = await db.query(
      'UPDATE cleanup_campaigns SET status = $1 WHERE campaign_id = $2 RETURNING *',
      [status, id]
    );

    res.json({ campaign: updateResult.rows[0] });
  } catch (error) {
    console.error('Update Campaign Status Error:', error);
    res.status(500).json({ error: 'Server error updating campaign status.' });
  }
};

// Update Volunteer Attendance and Certificate (NGO only)
exports.updateAttendance = async (req, res) => {
  const { id } = req.params; // campaign_id
  const { volunteer_id, attendance, certificate_status } = req.body;

  if (!volunteer_id) {
    return res.status(400).json({ error: 'Volunteer ID is required.' });
  }

  try {
    // Update campaign volunteer entry
    const updateQuery = `
      UPDATE campaign_volunteers 
      SET attendance = COALESCE($1, attendance), 
          certificate_status = COALESCE($2, certificate_status) 
      WHERE campaign_id = $3 AND volunteer_id = $4 
      RETURNING *
    `;
    const result = await db.query(updateQuery, [
      attendance !== undefined ? attendance : null,
      certificate_status !== undefined ? certificate_status : null,
      id,
      volunteer_id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Volunteer registration record not found for this campaign.' });
    }

    const updatedReg = result.rows[0];

    // If certificate is issued, create certificates record
    if (certificate_status === true) {
      // Check if certificate already exists
      const certCheck = await db.query(
        'SELECT certificate_id FROM certificates WHERE volunteer_id = $1 AND campaign_id = $2',
        [volunteer_id, id]
      );
      
      if (certCheck.rows.length === 0) {
        const certUrl = `/certificates/cert-${id.slice(0, 8)}-${volunteer_id.slice(0, 8)}.pdf`;
        await db.query(
          'INSERT INTO certificates (volunteer_id, campaign_id, certificate_url) VALUES ($1, $2, $3)',
          [volunteer_id, id, certUrl]
        );
        
        // Notify volunteer
        await db.query(
          `INSERT INTO notifications (user_id, title, message, reference_type, reference_id)
           VALUES ($1, 'Certificate Issued!', 'You have earned a participation certificate for your cleanup contributions.', 'Campaign', $2)`,
          [volunteer_id, id]
        );
      }
    }

    res.json({ registration: updatedReg });
  } catch (error) {
    console.error('Update Attendance Error:', error);
    res.status(500).json({ error: 'Server error updating attendance.' });
  }
};

// Get My Participation History & Certificates (Volunteer)
exports.getMyHistory = async (req, res) => {
  const volunteer_id = req.user.user_id;

  try {
    const historyQuery = `
      SELECT cv.id as registration_id, cv.joined_date, cv.attendance, cv.certificate_status,
             c.campaign_id, c.campaign_name, c.description, c.campaign_date, c.start_time, c.end_time, c.location, c.status as campaign_status,
             u.full_name as creator_name, u.organization_name,
             cert.certificate_id, cert.certificate_url, cert.issued_date
      FROM campaign_volunteers cv
      JOIN cleanup_campaigns c ON cv.campaign_id = c.campaign_id
      JOIN users u ON c.created_by = u.user_id
      LEFT JOIN certificates cert ON (cert.volunteer_id = cv.volunteer_id AND cert.campaign_id = cv.campaign_id)
      WHERE cv.volunteer_id = $1
      ORDER BY cv.joined_date DESC
    `;
    const historyResult = await db.query(historyQuery, [volunteer_id]);

    res.json({ history: historyResult.rows });
  } catch (error) {
    console.error('Get My History Error:', error);
    res.status(500).json({ error: 'Server error retrieving participation history.' });
  }
};
