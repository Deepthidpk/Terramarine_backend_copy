const db = require('../config/db');

// Create Biodiversity Report (Researcher only)
exports.createBiodiversityReport = async (req, res) => {
  const { species_name, observation, latitude, longitude, observed_date } = req.body;
  const researcher_id = req.user.user_id;

  if (!species_name) {
    return res.status(400).json({ error: 'Species name is required.' });
  }

  let imageUrl = null;
  if (req.file) {
    imageUrl = `/uploads/${req.file.filename}`;
  }

  try {
    const insertQuery = `
      INSERT INTO biodiversity_reports 
      (researcher_id, species_name, observation, latitude, longitude, image, observed_date) 
      VALUES ($1, $2, $3, $4, $5, $6, $7) 
      RETURNING *
    `;
    const values = [
      researcher_id,
      species_name,
      observation || null,
      latitude ? parseFloat(latitude) : null,
      longitude ? parseFloat(longitude) : null,
      imageUrl,
      observed_date || new Date()
    ];

    const result = await db.query(insertQuery, values);
    res.status(201).json({ report: result.rows[0] });
  } catch (error) {
    console.error('Create Biodiversity Error:', error);
    res.status(500).json({ error: 'Server error creating biodiversity log.' });
  }
};

// Get Biodiversity Reports
exports.getBiodiversityReports = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT b.*, u.full_name as researcher_name 
      FROM biodiversity_reports b
      JOIN users u ON b.researcher_id = u.user_id
      ORDER BY b.observed_date DESC
    `);
    res.json({ reports: result.rows });
  } catch (error) {
    console.error('Get Biodiversity Reports Error:', error);
    res.status(500).json({ error: 'Server error retrieving biodiversity logs.' });
  }
};
