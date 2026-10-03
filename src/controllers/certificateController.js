const db = require('../config/db');

// Get All Certificates for Logged-In Volunteer
exports.getMyCertificates = async (req, res) => {
  const volunteer_id = req.user.user_id;

  try {
    const queryText = `
      SELECT cert.certificate_id, cert.certificate_url, cert.issued_date,
             c.campaign_id, c.campaign_name, c.description, c.campaign_date, c.start_time, c.end_time, c.location,
             vol.full_name as volunteer_name, vol.email as volunteer_email,
             u.full_name as creator_name, u.organization_name
      FROM certificates cert
      JOIN cleanup_campaigns c ON cert.campaign_id = c.campaign_id
      JOIN users u ON c.created_by = u.user_id
      JOIN users vol ON cert.volunteer_id = vol.user_id
      WHERE cert.volunteer_id = $1
      ORDER BY cert.issued_date DESC
    `;
    const result = await db.query(queryText, [volunteer_id]);
    res.json({ certificates: result.rows });
  } catch (error) {
    console.error('Get My Certificates Error:', error);
    res.status(500).json({ error: 'Server error retrieving certificates.' });
  }
};

// Get Certificate Details by ID
exports.getCertificateById = async (req, res) => {
  const { id } = req.params;

  try {
    const queryText = `
      SELECT cert.certificate_id, cert.certificate_url, cert.issued_date,
             c.campaign_id, c.campaign_name, c.description, c.campaign_date, c.start_time, c.end_time, c.location,
             vol.full_name as volunteer_name, vol.email as volunteer_email,
             org.full_name as creator_name, org.organization_name
      FROM certificates cert
      JOIN cleanup_campaigns c ON cert.campaign_id = c.campaign_id
      JOIN users vol ON cert.volunteer_id = vol.user_id
      JOIN users org ON c.created_by = org.user_id
      WHERE cert.certificate_id = $1
    `;
    const result = await db.query(queryText, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Certificate not found.' });
    }

    res.json({ certificate: result.rows[0] });
  } catch (error) {
    console.error('Get Certificate Details Error:', error);
    res.status(500).json({ error: 'Server error retrieving certificate.' });
  }
};
