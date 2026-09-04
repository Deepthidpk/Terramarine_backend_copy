const db = require('../config/db');
const sendEmail = require('../utils/sendEmail');

// Create Campaign (NGO or Authority/Admin only)
exports.createCampaign = async (req, res) => {
  const { campaign_name, description, campaign_date, start_time, end_time, location, latitude, longitude, maximum_volunteers, visibility } = req.body;
  const created_by = req.user.user_id;

  if (!campaign_name || !campaign_date || !location) {
    return res.status(400).json({ error: 'Campaign name, date, and location are required.' });
  }

  try {
    const insertQuery = `
      INSERT INTO cleanup_campaigns 
      (created_by, campaign_name, description, campaign_date, start_time, end_time, location, latitude, longitude, maximum_volunteers, visibility, status) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'Upcoming') 
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
      maximum_volunteers ? parseInt(maximum_volunteers) : null,
      req.user.role === 'NGO' ? (visibility || 'Public') : 'Public'
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

    // Notify all Municipal Authorities & Admins when NGO/User creates Cleanup Campaign
    const organizerName = req.user.organization_name || req.user.full_name || 'An organization';
    await db.query(
      `INSERT INTO notifications (user_id, title, message, reference_type, reference_id)
       SELECT user_id, 'New Cleanup Campaign Organized', $1 || ' organized a new cleanup campaign "' || $2 || '" at ' || $3 || ' scheduled for ' || $4, 'Campaign', $5
       FROM users WHERE role IN ('Authority', 'Admin')`,
      [organizerName, campaign_name, location, campaign_date, newCampaign.campaign_id]
    );

    res.status(201).json({ campaign: newCampaign });
  } catch (error) {
    console.error('Create Campaign Error:', error);
    res.status(500).json({ error: 'Server error during campaign creation.' });
  }
};

const autoUpdateCampaignStatuses = async () => {
  try {
    // 1. Mark campaigns as Completed if campaign_date is in past, or today and end_time (or start_time + 4hrs) has passed
    await db.query(`
      UPDATE cleanup_campaigns 
      SET status = 'Completed' 
      WHERE status IN ('Upcoming', 'Ongoing') 
        AND (
          campaign_date < CURRENT_DATE 
          OR (
            campaign_date = CURRENT_DATE 
            AND (
              (end_time IS NOT NULL AND end_time <= CURRENT_TIME)
              OR (end_time IS NULL AND start_time IS NOT NULL AND (start_time + INTERVAL '4 hours') <= CURRENT_TIME)
            )
          )
        )
    `);

    // 2. Mark campaigns as Ongoing if today and start_time <= CURRENT_TIME and end_time > CURRENT_TIME
    await db.query(`
      UPDATE cleanup_campaigns 
      SET status = 'Ongoing' 
      WHERE status = 'Upcoming' 
        AND campaign_date = CURRENT_DATE 
        AND start_time IS NOT NULL AND start_time <= CURRENT_TIME 
        AND (end_time IS NULL OR end_time > CURRENT_TIME)
    `);
  } catch (err) {
    console.error('Auto update campaign statuses error:', err);
  }
};

// Get All Campaigns
exports.getCampaigns = async (req, res) => {
  await autoUpdateCampaignStatuses();

  const { status } = req.query;
  const user_id = req.user ? req.user.user_id : null;

  let queryText = `
    SELECT c.*, u.full_name as creator_name, u.organization_name,
      (SELECT COUNT(*)::int FROM campaign_volunteers cv WHERE cv.campaign_id = c.campaign_id AND cv.registration_status = 'Approved') as volunteer_count
      ${user_id ? `, EXISTS(SELECT 1 FROM campaign_volunteers cv2 WHERE cv2.campaign_id = c.campaign_id AND cv2.volunteer_id = $1) as is_joined, (SELECT registration_status FROM campaign_volunteers cv3 WHERE cv3.campaign_id = c.campaign_id AND cv3.volunteer_id = $1 LIMIT 1) as registration_status` : ''}
    FROM cleanup_campaigns c
    JOIN users u ON c.created_by = u.user_id
    WHERE 1=1
  `;
  const params = user_id ? [user_id] : [];

  if (status) {
    params.push(status);
    queryText += ` AND c.status = $${params.length}`;
  }

  if (user_id) {
    queryText += ` AND (c.visibility = 'Public' OR c.created_by = $1 OR EXISTS(SELECT 1 FROM campaign_volunteers cv4 WHERE cv4.campaign_id = c.campaign_id AND cv4.volunteer_id = $1))`;
  } else {
    queryText += ` AND c.visibility = 'Public'`;
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
  await autoUpdateCampaignStatuses();

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
      SELECT cv.id as registration_id, cv.joined_date, cv.attendance, cv.certificate_status, cv.registration_status,
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
    const campaignResult = await db.query('SELECT status, maximum_volunteers, visibility FROM cleanup_campaigns WHERE campaign_id = $1', [campaign_id]);
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
      return res.status(400).json({ error: 'You have already registered for this campaign.', is_joined: true });
    }

    // Insert volunteer record
    const regStatus = campaign.visibility === 'Private' ? 'Pending' : 'Approved';
    await db.query(
      'INSERT INTO campaign_volunteers (campaign_id, volunteer_id, registration_status) VALUES ($1, $2, $3)',
      [campaign_id, volunteer_id, regStatus]
    );

    // In-app Notification to Volunteer
    const notifMsg = campaign.visibility === 'Private' ? 'Your request to join the campaign is pending approval.' : 'You have successfully registered for the cleanup campaign drive.';
    await db.query(
      `INSERT INTO notifications (user_id, title, message, reference_type, reference_id)
       VALUES ($1, 'Campaign Registration', $2, 'CleanupCampaign', $3)`,
      [volunteer_id, notifMsg, campaign_id]
    );

    // Notify Municipal Authorities and Campaign Creator about volunteer joining
    const volunteerName = req.user.full_name || 'A volunteer';
    const campDetailsQuery = await db.query('SELECT campaign_name, location, campaign_date, created_by FROM cleanup_campaigns WHERE campaign_id = $1', [campaign_id]);
    if (campDetailsQuery.rows.length > 0) {
      const camp = campDetailsQuery.rows[0];
      const campDateStr = new Date(camp.campaign_date).toLocaleDateString();
      const joinMsg = `${volunteerName} has joined the cleanup campaign "${camp.campaign_name}" scheduled for ${campDateStr} at ${camp.location}.`;

      await db.query(
        `INSERT INTO notifications (user_id, title, message, reference_type, reference_id)
         SELECT user_id, 'Volunteer Joined Campaign', $1, 'Campaign', $2
         FROM users WHERE role IN ('Authority', 'Admin') OR user_id = $3`,
        [joinMsg, campaign_id, camp.created_by]
      );
    }

    // Dispatch Email Notification
    if (req.user && req.user.email) {
      sendEmail({
        to: req.user.email,
        subject: `TerraMarine - Campaign Registration Confirmed`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #0f172a;">
            <h2 style="color: #0284c7;">ðŸŒŠ TerraMarine Cleanup Registration</h2>
            <p>Dear <strong>${req.user.full_name}</strong>,</p>
            <p>Your registration for the coastal cleanup drive has been confirmed!</p>
            <p>Thank you for contributing to coastal ecosystem restoration.</p>
          </div>
        `
      }).catch(err => console.error('Email error:', err.message));
    }

    res.status(201).json({ message: campaign.visibility === 'Private' ? 'Successfully requested to join campaign.' : 'Successfully registered for campaign.' });
  } catch (error) {
    console.error('Join Campaign Error:', error);
    res.status(500).json({ error: 'Server error registering for campaign.' });
  }
};

// Update Volunteer Status (Approve/Reject)
exports.updateVolunteerStatus = async (req, res) => {
  const { id, volunteer_id } = req.params;
  const { status } = req.body;

  if (!['Approved', 'Rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status.' });
  }

  try {
    const updateResult = await db.query(
      'UPDATE campaign_volunteers SET registration_status = $1 WHERE campaign_id = $2 AND volunteer_id = $3 RETURNING *',
      [status, id, volunteer_id]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Volunteer registration not found.' });
    }

    // send notification to volunteer
    await db.query(
      `INSERT INTO notifications (user_id, title, message, reference_type, reference_id)
       VALUES ($1, $2, $3, 'Campaign', $4)`,
      [volunteer_id, `Campaign Request ${status}`, `Your request to join the campaign has been ${status.toLowerCase()}.`, id]
    );

    res.json({ message: `Volunteer ${status.toLowerCase()} successfully.` });
  } catch (error) {
    console.error('Update Volunteer Status Error:', error);
    res.status(500).json({ error: 'Server error updating volunteer status.' });
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
    // If certificate is being issued, validate preconditions
    if (certificate_status === true) {
      const campRes = await db.query('SELECT campaign_date, status FROM cleanup_campaigns WHERE campaign_id = $1', [id]);
      if (campRes.rows.length > 0) {
        const camp = campRes.rows[0];
        const campDateStr = new Date(camp.campaign_date).toISOString().slice(0, 10);
        const todayStr = new Date().toISOString().slice(0, 10);
        const isEnded = camp.status === 'Completed' || campDateStr < todayStr;
        if (!isEnded) {
          return res.status(400).json({ error: 'Certificates can only be issued after the campaign has ended.' });
        }
      }

      const volRegCheck = await db.query('SELECT attendance FROM campaign_volunteers WHERE campaign_id = $1 AND volunteer_id = $2', [id, volunteer_id]);
      const isAttended = attendance !== undefined ? attendance : (volRegCheck.rows[0]?.attendance);
      if (!isAttended) {
        return res.status(400).json({ error: 'Volunteer must be marked as attended before issuing a certificate.' });
      }
    }

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
  await autoUpdateCampaignStatuses();

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
    console.error('My History Error:', error);
    res.status(500).json({ error: 'Server error fetching history.' });
  }
};

// Assign Volunteer (NGO only)
exports.assignVolunteer = async (req, res) => {
  const { full_name, email, phone } = req.body;
  const ngoUser = req.user;

  if (!full_name || !full_name.trim() || full_name.trim().length < 3 || full_name.trim().length > 50 || !/^[a-zA-Z0-9\s]+$/.test(full_name.trim())) {
    return res.status(400).json({ error: 'Volunteer full name must be 3-50 characters and can only contain letters, digits, and spaces.' });
  }

  if (!email || !email.trim() || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim())) {
    return res.status(400).json({ error: 'A valid email address is required (e.g. volunteer@example.com).' });
  }

  const cleanPhone = (phone || '').trim();
  if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
    return res.status(400).json({ error: 'Phone number must be exactly 10 digits and start with 6, 7, 8, or 9.' });
  }

  const cleanName = full_name.trim();
  const cleanEmail = email.trim().toLowerCase();

  try {
    const emailCheck = await db.query('SELECT user_id FROM users WHERE LOWER(email) = LOWER($1)', [cleanEmail]);
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ error: 'A user with this email address already exists.' });
    }

    const phoneCheck = await db.query('SELECT user_id FROM users WHERE phone = $1', [cleanPhone]);
    if (phoneCheck.rows.length > 0) {
      return res.status(400).json({ error: 'A user with this phone number already exists.' });
    }

    const bcrypt = require('bcryptjs');
    const tempPassword = `Volunteer#${Math.floor(1000 + Math.random() * 9000)}`;
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const userDistrict = ngoUser.district || 'Kochi';
    const userState = ngoUser.state || 'Kerala';

    const insertQuery = `
      INSERT INTO users (
        full_name, email, phone, password_hash, role, status, district, state, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, 'Volunteer', 'Active', $5, $6, NOW(), NOW()
      )
      RETURNING user_id, full_name, email, phone, role, status, created_at
    `;

    const result = await db.query(insertQuery, [
      cleanName,
      cleanEmail,
      cleanPhone,
      passwordHash,
      userDistrict,
      userState
    ]);

    const newVolunteer = result.rows[0];

    const sendEmail = require('../utils/sendEmail');
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const loginLink = `${frontendUrl}/login`;

    sendEmail({
      to: cleanEmail,
      subject: `Welcome to TerraMarine - Volunteer Account Created`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 24px; color: #0f172a; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="${frontendUrl}/images/whale_logo_icon.png" alt="TerraMarine Logo" height="48" style="margin-bottom: 12px;" />
            <h2 style="color: #0284c7; margin: 0;">TerraMarine Coastal Support</h2>
            <p style="color: #64748b; font-size: 0.9rem; margin-top: 4px;">Official Coastal Cleanup Platform</p>
          </div>
          <p>Dear <strong>${cleanName}</strong>,</p>
          <p>You have been registered as a <strong>Volunteer</strong> by an NGO on the TerraMarine platform.</p>
          <div style="background: #f0f9ff; padding: 18px; border-radius: 10px; border-left: 4px solid #0284c7; margin: 20px 0;">
            <h4 style="margin: 0 0 10px 0; color: #0369a1;">Your Login Credentials</h4>
            <p style="margin: 6px 0;"><strong>Portal Login Link:</strong> <a href="${loginLink}" style="color: #0284c7; font-weight: bold; text-decoration: underline;">${loginLink}</a></p>
            <p style="margin: 6px 0;"><strong>Login Email:</strong> <span style="color: #0f172a; font-weight: 600;">${cleanEmail}</span></p>
            <p style="margin: 6px 0;"><strong>Temporary Password:</strong> <span style="font-family: monospace; font-weight: bold; background: #e2e8f0; padding: 3px 8px; border-radius: 4px; color: #0f172a;">${tempPassword}</span></p>
          </div>
          <p>Log in using the credentials above to explore upcoming cleanup campaigns and contribute to a cleaner environment.</p>
          <div style="text-align: center; margin-top: 24px;">
            <a href="${loginLink}" style="display: inline-block; background: #0284c7; color: #ffffff; padding: 12px 24px; border-radius: 8px; font-weight: bold; text-decoration: none;">Access Volunteer Dashboard</a>
          </div>
        </div>
      `
    }).catch(err => console.error('Email dispatch error when adding volunteer:', err.message));

    res.status(201).json({
      message: `Volunteer "${cleanName}" registered successfully! Login details sent to ${cleanEmail}.`,
      volunteer: newVolunteer,
      tempPassword
    });
  } catch (error) {
    console.error('Add Volunteer Error:', error);
    res.status(500).json({ error: 'Server error registering volunteer.' });
  }
};
