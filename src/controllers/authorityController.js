const db = require('../config/db');

// 1. Get operational users (Volunteers, Researchers, NGOs, Citizens) within Authority's district
exports.getDistrictUsers = async (req, res) => {
  try {
    const { status, role } = req.query;
    const authorityDistrict = req.user.district; // From authMiddleware

    let query = `
      SELECT user_id, full_name, email, phone, role, organization_name, address, 
             district, state, status, created_at, registration_number, 
             organization_address, registration_certificate_url, institution_name, 
             department, research_area, institution_id_url, government_id_type, 
             government_id_number, government_id_url, fishing_license_number, 
             boat_registration_number 
      FROM users
      WHERE role NOT IN ('Admin', 'Authority')
    `;
    const params = [];

    // Filter by district if authority has a district set
    if (authorityDistrict) {
      params.push(authorityDistrict);
      query += ` AND (district = $${params.length} OR district IS NULL)`;
    }

    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }

    if (role) {
      params.push(role);
      query += ` AND role = $${params.length}`;
    }

    query += ' ORDER BY created_at DESC';

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
