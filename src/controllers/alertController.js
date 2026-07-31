const db = require('../config/db');

// Create Weather/Marine Alert (Authority/Admin only)
exports.createAlert = async (req, res) => {
  const { title, description, alert_type, severity, latitude, longitude, radius_km, expiry_time } = req.body;
  const issued_by = req.user.user_id;

  if (!title || !alert_type || !severity) {
    return res.status(400).json({ error: 'Title, alert type, and severity are required.' });
  }

  try {
    const insertQuery = `
      INSERT INTO weather_alerts 
      (issued_by, title, description, alert_type, severity, latitude, longitude, radius_km, expiry_time) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
      RETURNING *
    `;
    const values = [
      issued_by,
      title,
      description || null,
      alert_type,
      severity,
      latitude ? parseFloat(latitude) : null,
      longitude ? parseFloat(longitude) : null,
      radius_km ? parseFloat(radius_km) : null,
      expiry_time || null
    ];

    const result = await db.query(insertQuery, values);
    const newAlert = result.rows[0];

    // Create notifications for all fishermen
    await db.query(
      `INSERT INTO notifications (user_id, title, message, reference_type, reference_id)
       SELECT user_id, 'Severe Alert: ' || $1, $2, 'WeatherAlert', $3
       FROM users WHERE role = 'Fisherman'`,
      [title, description || 'A new weather advisory has been issued.', newAlert.alert_id]
    );

    res.status(201).json({ alert: newAlert });
  } catch (error) {
    console.error('Create Alert Error:', error);
    res.status(500).json({ error: 'Server error creating weather alert.' });
  }
};

// Get Active & Historical Alerts
exports.getAlerts = async (req, res) => {
  try {
    // Return alerts that haven't expired, or all alerts sorted by time
    const result = await db.query(`
      SELECT a.*, u.full_name as issuer_name 
      FROM weather_alerts a
      LEFT JOIN users u ON a.issued_by = u.user_id
      WHERE a.expiry_time IS NULL OR a.expiry_time > NOW()
      ORDER BY a.issued_time DESC
    `);
    res.json({ alerts: result.rows });
  } catch (error) {
    console.error('Get Alerts Error:', error);
    res.status(500).json({ error: 'Server error retrieving weather alerts.' });
  }
};
