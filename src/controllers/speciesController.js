const db = require('../config/db');

// Get all marine species
exports.getAllSpecies = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        s.species_id as id,
        s.species_id,
        s.name,
        s.scientific_name as "scientificName",
        s.category,
        s.status,
        s.habitat,
        s.threats,
        s.sensitivity,
        s.notes,
        s.image,
        s.created_by,
        s.created_by_name,
        s.created_at,
        u.full_name as author_name,
        u.role as author_role
      FROM species_catalog s
      LEFT JOIN users u ON s.created_by = u.user_id
      ORDER BY s.species_id ASC
    `);
    res.json({ species: result.rows });
  } catch (error) {
    console.error('Get All Species Error:', error);
    res.status(500).json({ error: 'Server error retrieving marine species catalog.' });
  }
};

// Get single species by ID
exports.getSpeciesById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(`
      SELECT 
        s.species_id as id,
        s.species_id,
        s.name,
        s.scientific_name as "scientificName",
        s.category,
        s.status,
        s.habitat,
        s.threats,
        s.sensitivity,
        s.notes,
        s.image,
        s.created_by,
        s.created_by_name,
        s.created_at,
        u.full_name as author_name
      FROM species_catalog s
      LEFT JOIN users u ON s.created_by = u.user_id
      WHERE s.species_id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Species not found.' });
    }

    res.json({ species: result.rows[0] });
  } catch (error) {
    console.error('Get Species Detail Error:', error);
    res.status(500).json({ error: 'Server error retrieving species details.' });
  }
};

// Create / Add New Species (Authority, Researcher, Admin)
exports.createSpecies = async (req, res) => {
  const {
    name,
    scientific_name,
    scientificName,
    category,
    status,
    habitat,
    threats,
    sensitivity,
    notes,
    image_url
  } = req.body;

  const finalScientificName = scientific_name || scientificName;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Species common name is required.' });
  }
  if (!finalScientificName || !finalScientificName.trim()) {
    return res.status(400).json({ error: 'Scientific name is required.' });
  }
  if (!category || !category.trim()) {
    return res.status(400).json({ error: 'Taxonomy category is required.' });
  }

  let imageUrl = image_url || null;
  if (req.file) {
    imageUrl = `/uploads/${req.file.filename}`;
  }

  const userId = req.user?.user_id || null;
  const userName = req.user?.full_name || req.user?.name || 'Authority Administrator';

  try {
    const query = `
      INSERT INTO species_catalog 
      (name, scientific_name, category, status, habitat, threats, sensitivity, notes, image, created_by, created_by_name)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING 
        species_id as id,
        species_id,
        name,
        scientific_name as "scientificName",
        category,
        status,
        habitat,
        threats,
        sensitivity,
        notes,
        image,
        created_by,
        created_by_name,
        created_at
    `;
    const values = [
      name.trim(),
      finalScientificName.trim(),
      category.trim(),
      status || 'Least Concern',
      habitat || null,
      threats || null,
      sensitivity || 'Medium',
      notes || null,
      imageUrl,
      userId,
      userName
    ];

    const result = await db.query(query, values);
    res.status(201).json({ 
      message: 'Marine species registered successfully!', 
      species: result.rows[0] 
    });
  } catch (error) {
    console.error('Create Species Error:', error);
    res.status(500).json({ error: 'Server error registering new species.' });
  }
};

// Update Species
exports.updateSpecies = async (req, res) => {
  const { id } = req.params;
  const {
    name,
    scientific_name,
    scientificName,
    category,
    status,
    habitat,
    threats,
    sensitivity,
    notes,
    image_url
  } = req.body;

  const finalScientificName = scientific_name || scientificName;

  try {
    const check = await db.query('SELECT * FROM species_catalog WHERE species_id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Species record not found.' });
    }

    let imageUrl = check.rows[0].image;
    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    } else if (image_url !== undefined) {
      imageUrl = image_url;
    }

    const query = `
      UPDATE species_catalog 
      SET 
        name = COALESCE($1, name),
        scientific_name = COALESCE($2, scientific_name),
        category = COALESCE($3, category),
        status = COALESCE($4, status),
        habitat = COALESCE($5, habitat),
        threats = COALESCE($6, threats),
        sensitivity = COALESCE($7, sensitivity),
        notes = COALESCE($8, notes),
        image = COALESCE($9, image)
      WHERE species_id = $10
      RETURNING 
        species_id as id,
        species_id,
        name,
        scientific_name as "scientificName",
        category,
        status,
        habitat,
        threats,
        sensitivity,
        notes,
        image,
        created_by,
        created_by_name,
        created_at
    `;
    const values = [
      name ? name.trim() : null,
      finalScientificName ? finalScientificName.trim() : null,
      category ? category.trim() : null,
      status || null,
      habitat || null,
      threats || null,
      sensitivity || null,
      notes || null,
      imageUrl,
      id
    ];

    const result = await db.query(query, values);
    res.json({ 
      message: 'Marine species updated successfully!', 
      species: result.rows[0] 
    });
  } catch (error) {
    console.error('Update Species Error:', error);
    res.status(500).json({ error: 'Server error updating species.' });
  }
};

// Delete Species (Authority, Admin)
exports.deleteSpecies = async (req, res) => {
  const { id } = req.params;
  try {
    const check = await db.query('SELECT * FROM species_catalog WHERE species_id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Species record not found.' });
    }

    await db.query('DELETE FROM species_catalog WHERE species_id = $1', [id]);
    res.json({ message: 'Marine species deleted from catalog successfully.' });
  } catch (error) {
    console.error('Delete Species Error:', error);
    res.status(500).json({ error: 'Server error deleting species.' });
  }
};
