const db = require('../config/db');
const bcrypt = require('bcryptjs');
const sendEmail = require('../utils/sendEmail');

// 1. Get operational users (Volunteers, Researchers, NGOs, Citizens, Workers, Fishermen)
exports.getDistrictUsers = async (req, res) => {
  try {
    const { status, role } = req.query;

    let query = `
      SELECT u.user_id, u.full_name, u.email, u.phone, u.role, u.organization_name, u.address, 
             u.district, u.state, u.status, u.created_at, u.registration_number, 
             u.organization_address, u.registration_certificate_url, u.institution_name, 
             u.department, u.research_area, u.institution_id_url, u.government_id_type, 
             u.government_id_number, u.government_id_url, u.fishing_license_number, 
             u.boat_registration_number,
             (
               SELECT COUNT(*)::int
               FROM cleanup_tasks t
               WHERE t.status IN ('Pending', 'In Progress')
                 AND (t.assigned_worker = u.user_id::text OR t.assigned_worker ILIKE '%' || u.user_id::text || '%')
             ) as active_tasks_count,
             (
               SELECT string_agg(DISTINCT d_str, ', ')
               FROM (
                 SELECT TO_CHAR(t.deadline AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') as d_str
                 FROM cleanup_tasks t
                 WHERE t.status IN ('Pending', 'In Progress')
                   AND (t.assigned_worker = u.user_id::text OR t.assigned_worker ILIKE '%' || u.user_id::text || '%')
                   AND t.deadline IS NOT NULL
                 UNION
                 SELECT TO_CHAR(t.deadline, 'YYYY-MM-DD') as d_str
                 FROM cleanup_tasks t
                 WHERE t.status IN ('Pending', 'In Progress')
                   AND (t.assigned_worker = u.user_id::text OR t.assigned_worker ILIKE '%' || u.user_id::text || '%')
                   AND t.deadline IS NOT NULL
                 UNION
                 SELECT TO_CHAR(t.assigned_date AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') as d_str
                 FROM cleanup_tasks t
                 WHERE t.status IN ('Pending', 'In Progress')
                   AND (t.assigned_worker = u.user_id::text OR t.assigned_worker ILIKE '%' || u.user_id::text || '%')
                   AND t.assigned_date IS NOT NULL
                 UNION
                 SELECT TO_CHAR(t.assigned_date, 'YYYY-MM-DD') as d_str
                 FROM cleanup_tasks t
                 WHERE t.status IN ('Pending', 'In Progress')
                   AND (t.assigned_worker = u.user_id::text OR t.assigned_worker ILIKE '%' || u.user_id::text || '%')
                   AND t.assigned_date IS NOT NULL
                 UNION
                 SELECT TO_CHAR(t.assigned_date AT TIME ZONE 'UTC', 'YYYY-MM-DD') as d_str
                 FROM cleanup_tasks t
                 WHERE t.status IN ('Pending', 'In Progress')
                   AND (t.assigned_worker = u.user_id::text OR t.assigned_worker ILIKE '%' || u.user_id::text || '%')
                   AND t.assigned_date IS NOT NULL
                 UNION
                 SELECT TO_CHAR(t.deadline AT TIME ZONE 'UTC', 'YYYY-MM-DD') as d_str
                 FROM cleanup_tasks t
                 WHERE t.status IN ('Pending', 'In Progress')
                   AND (t.assigned_worker = u.user_id::text OR t.assigned_worker ILIKE '%' || u.user_id::text || '%')
                   AND t.deadline IS NOT NULL
               ) dates_sub
             ) as busy_dates,
             (
               SELECT string_agg(DISTINCT r.title || ' (' || COALESCE(TO_CHAR(t.deadline AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD'), TO_CHAR(t.deadline, 'YYYY-MM-DD'), TO_CHAR(t.assigned_date AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD'), TO_CHAR(t.assigned_date, 'YYYY-MM-DD')) || ')', '; ')
               FROM cleanup_tasks t
               JOIN pollution_reports r ON t.report_id = r.report_id
               WHERE t.status IN ('Pending', 'In Progress')
                 AND (t.assigned_worker = u.user_id::text OR t.assigned_worker ILIKE '%' || u.user_id::text || '%')
             ) as active_task_names
      FROM users u
      WHERE u.role NOT IN ('Admin', 'Authority')
    `;
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND u.status = $${params.length}`;
    }

    if (role) {
      params.push(role);
      query += ` AND u.role = $${params.length}`;
    }

    query += ' ORDER BY u.created_at DESC';

    const result = await db.query(query, params);
    res.json({ users: result.rows });
  } catch (error) {
    console.error('Get District Users Error:', error);
    res.status(500).json({ error: 'Server error retrieving operational users.' });
  }
};

// 2. Update Operational User Status (Approve/Reject/Suspend/Activate)
exports.updateDistrictUserStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status is required.' });
  }

  const allowedStatuses = ['Active', 'Suspended', 'Pending', 'Rejected'];
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status value.' });
  }

  try {
    const checkUser = await db.query('SELECT user_id, role, status FROM users WHERE user_id = $1', [id]);
    if (checkUser.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (['Admin', 'Authority'].includes(checkUser.rows[0].role)) {
      return res.status(403).json({ error: 'Municipal Authorities can only manage operational users (Volunteers, Researchers, NGOs, Citizens).' });
    }

    const result = await db.query(
      `UPDATE users 
       SET status = $1::account_status, 
           updated_at = NOW() 
       WHERE user_id = $2 
       RETURNING user_id, full_name, email, role, status`,
      [status, id]
    );

    // Record audit log
    await db.query(
      `INSERT INTO system_audit_logs (user_id, user_email, action, details) 
       VALUES ($1, $2, $3, $4)`,
      [req.user.user_id, req.user.email, 'AUTHORITY_USER_STATUS_CHANGE', `Changed user ${id} status to ${status}`]
    );

    res.json({ 
      message: `User status updated to ${status} successfully.`, 
      user: result.rows[0] 
    });
  } catch (error) {
    console.error('Update District User Status Error:', error);
    res.status(500).json({ error: 'Server error updating user status.' });
  }
};

// 3. Add Cleanup Worker (Authority / Admin only)
exports.addWorker = async (req, res) => {
  const { full_name, email, phone } = req.body;
  const authorityUser = req.user;

  if (!full_name || !full_name.trim() || full_name.trim().length < 3 || full_name.trim().length > 50 || !/^[a-zA-Z\s.'-]+$/.test(full_name.trim())) {
    return res.status(400).json({ error: 'Worker full name must be 3-50 letters without numbers or special symbols.' });
  }

  if (!email || !email.trim() || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim())) {
    return res.status(400).json({ error: 'A valid email address is required (e.g. worker@example.com).' });
  }

  const digitsOnly = (phone || '').replace(/\D/g, '');
  if (!phone || !phone.trim() || digitsOnly.length < 10 || digitsOnly.length > 13) {
    return res.status(400).json({ error: 'A valid 10-digit mobile phone number is required.' });
  }

  const cleanName = full_name.trim();
  const cleanEmail = email.trim().toLowerCase();
  const cleanPhone = phone.trim();

  try {
    // Check if email already exists
    const emailCheck = await db.query('SELECT user_id FROM users WHERE LOWER(email) = LOWER($1)', [cleanEmail]);
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ error: 'A user with this email address already exists.' });
    }

    // Check if phone already exists (if provided)
    if (cleanPhone) {
      const phoneCheck = await db.query('SELECT user_id FROM users WHERE phone = $1', [cleanPhone]);
      if (phoneCheck.rows.length > 0) {
        return res.status(400).json({ error: 'A user with this phone number already exists.' });
      }
    }

    // Auto-generate password e.g. Worker#5821
    const tempPassword = `Worker#${Math.floor(1000 + Math.random() * 9000)}`;
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const userDistrict = authorityUser.district || 'Kochi';
    const userState = authorityUser.state || 'Kerala';

    const insertQuery = `
      INSERT INTO users (
        full_name, email, phone, password_hash, role, status, district, state, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, 'Worker', 'Active', $5, $6, NOW(), NOW()
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

    const newWorker = result.rows[0];

    // Record audit log
    await db.query(
      `INSERT INTO system_audit_logs (user_id, user_email, action, details)
       VALUES ($1, $2, $3, $4)`,
      [authorityUser.user_id, authorityUser.email, 'AUTHORITY_ADD_WORKER', `Added cleanup worker ${cleanName} (${cleanEmail})`]
    ).catch(err => console.error('Audit log error:', err.message));

    // Frontend URL for link in email
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const loginLink = `${frontendUrl}/login`;

    // Send Email to Worker
    sendEmail({
      to: cleanEmail,
      subject: `Welcome to TerraMarine - Cleanup Worker Account Created`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 24px; color: #0f172a; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #0284c7; margin: 0;">🌊 TerraMarine Coastal Support</h2>
            <p style="color: #64748b; font-size: 0.9rem; margin-top: 4px;">Official Coastal Cleanup Platform</p>
          </div>
          <p>Dear <strong>${cleanName}</strong>,</p>
          <p>You have been registered as an official <strong>Cleanup Task Worker</strong> by Municipal Authorities.</p>
          <div style="background: #f0f9ff; padding: 18px; border-radius: 10px; border-left: 4px solid #0284c7; margin: 20px 0;">
            <h4 style="margin: 0 0 10px 0; color: #0369a1;">🔑 Your Login Credentials</h4>
            <p style="margin: 6px 0;"><strong>Portal Login Link:</strong> <a href="${loginLink}" style="color: #0284c7; font-weight: bold; text-decoration: underline;">${loginLink}</a></p>
            <p style="margin: 6px 0;"><strong>Login Email:</strong> <span style="color: #0f172a; font-weight: 600;">${cleanEmail}</span></p>
            <p style="margin: 6px 0;"><strong>Temporary Password:</strong> <span style="font-family: monospace; font-weight: bold; background: #e2e8f0; padding: 3px 8px; border-radius: 4px; color: #0f172a;">${tempPassword}</span></p>
          </div>
          <p>Log in using the credentials above to view assigned coastal cleanup tasks, upload completion proofs, and receive rewards.</p>
          <div style="text-align: center; margin-top: 24px;">
            <a href="${loginLink}" style="display: inline-block; background: #0284c7; color: #ffffff; padding: 12px 24px; border-radius: 8px; font-weight: bold; text-decoration: none;">Access Worker Dashboard</a>
          </div>
        </div>
      `
    }).catch(err => console.error('Email dispatch error when adding worker:', err.message));

    res.status(201).json({
      message: `Worker "${cleanName}" registered successfully! Login details sent to ${cleanEmail}.`,
      worker: newWorker,
      tempPassword
    });
  } catch (error) {
    console.error('Add Worker Error:', error);
    res.status(500).json({ error: 'Server error registering cleanup worker.' });
  }
};
