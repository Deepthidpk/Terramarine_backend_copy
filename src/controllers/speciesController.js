const db = require('../config/db');

// =========================================================================
// 1. Species Catalog CRUD
// =========================================================================

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

  const finalScientificName = (scientific_name || scientificName || '').trim();
  const trimmedName = (name || '').trim();
  const trimmedCat = (category || '').trim();

  // 1. Common Name validation
  if (!trimmedName) {
    return res.status(400).json({ error: 'Species common name is required.' });
  }
  if (trimmedName.length < 3) {
    return res.status(400).json({ error: 'Common name must be at least 3 characters long.' });
  }
  if (trimmedName.length > 100) {
    return res.status(400).json({ error: 'Common name cannot exceed 100 characters.' });
  }
  if (!/^[a-zA-Z0-9\s\-()']+$/.test(trimmedName)) {
    return res.status(400).json({ error: 'Common name can only contain letters, digits, spaces, hyphens, and parentheses.' });
  }

  // 2. Scientific Name validation
  if (!finalScientificName) {
    return res.status(400).json({ error: 'Scientific taxonomy name is required.' });
  }
  if (finalScientificName.length < 3) {
    return res.status(400).json({ error: 'Scientific taxonomy must be at least 3 characters long.' });
  }
  if (finalScientificName.length > 100) {
    return res.status(400).json({ error: 'Scientific taxonomy cannot exceed 100 characters.' });
  }
  if (!/^[a-zA-Z0-9\s\-.'()]+$/.test(finalScientificName)) {
    return res.status(400).json({ error: 'Scientific taxonomy can only contain letters, digits, spaces, hyphens, periods, and parentheses.' });
  }

  // 3. Category validation
  if (!trimmedCat) {
    return res.status(400).json({ error: 'Taxonomy category is required.' });
  }

  // 4. Habitat validation if provided
  const trimmedHabitat = (habitat || '').trim();
  if (trimmedHabitat) {
    if (trimmedHabitat.length < 3) {
      return res.status(400).json({ error: 'Typical habitat must be at least 3 characters long.' });
    }
    if (trimmedHabitat.length > 300) {
      return res.status(400).json({ error: 'Typical habitat cannot exceed 300 characters.' });
    }
  }

  // 5. Threats validation if provided
  const trimmedThreats = (threats || '').trim();
  if (trimmedThreats) {
    if (trimmedThreats.length < 3) {
      return res.status(400).json({ error: 'Anthropogenic threats must be at least 3 characters long.' });
    }
    if (trimmedThreats.length > 300) {
      return res.status(400).json({ error: 'Anthropogenic threats cannot exceed 300 characters.' });
    }
  }

  // 6. Notes validation if provided
  const trimmedNotes = (notes || '').trim();
  if (trimmedNotes) {
    if (trimmedNotes.length < 5) {
      return res.status(400).json({ error: 'Research field notes must be at least 5 characters long.' });
    }
    if (trimmedNotes.length > 1000) {
      return res.status(400).json({ error: 'Research field notes cannot exceed 1000 characters.' });
    }
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

// =========================================================================
// 2. Species Categories Management
// =========================================================================

// Get All Species Categories
exports.getSpeciesCategories = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT category_id as id, category_id, name, is_default, created_at
      FROM species_categories
      ORDER BY category_id ASC
    `);
    res.json({ categories: result.rows });
  } catch (error) {
    console.error('Get Species Categories Error:', error);
    res.status(500).json({ error: 'Server error retrieving species categories.' });
  }
};

// Add New Species Category (Authority, Admin)
exports.addSpeciesCategory = async (req, res) => {
  const { name } = req.body;
  const categoryName = (name || '').trim();

  if (!categoryName) {
    return res.status(400).json({ error: 'Taxonomy category name is required.' });
  }
  if (categoryName.length < 3) {
    return res.status(400).json({ error: 'Taxonomy category name must be at least 3 characters long.' });
  }
  if (categoryName.length > 40) {
    return res.status(400).json({ error: 'Taxonomy category name cannot exceed 40 characters.' });
  }
  if (!/^[a-zA-Z0-9\s\-]+$/.test(categoryName)) {
    return res.status(400).json({ error: 'Category name can only contain letters, numbers, spaces, and hyphens.' });
  }

  const userId = req.user?.user_id || null;

  try {
    const check = await db.query('SELECT * FROM species_categories WHERE LOWER(name) = LOWER($1)', [categoryName]);
    if (check.rows.length > 0) {
      return res.status(400).json({ error: 'A taxonomy category with this name already exists.' });
    }

    const result = await db.query(`
      INSERT INTO species_categories (name, is_default, created_by)
      VALUES ($1, false, $2)
      RETURNING category_id as id, category_id, name, is_default, created_at
    `, [categoryName, userId]);

    res.status(201).json({
      message: 'New taxonomy category created successfully!',
      category: result.rows[0]
    });
  } catch (error) {
    console.error('Add Species Category Error:', error);
    res.status(500).json({ error: 'Server error creating taxonomy category.' });
  }
};

// Delete Species Category (Authority, Admin)
exports.deleteSpeciesCategory = async (req, res) => {
  const { id } = req.params;
  try {
    const check = await db.query('SELECT * FROM species_categories WHERE category_id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Taxonomy category not found.' });
    }

    const categoryName = check.rows[0].name;

    // Check if any species is currently using this category
    const countCheck = await db.query('SELECT COUNT(*)::int as count FROM species_catalog WHERE category = $1', [categoryName]);
    if (countCheck.rows[0].count > 0) {
      return res.status(400).json({ 
        error: `Cannot delete category "${categoryName}" because ${countCheck.rows[0].count} species in the catalog are currently assigned to it. Please reassign those species first.` 
      });
    }

    await db.query('DELETE FROM species_categories WHERE category_id = $1', [id]);
    res.json({ message: `Taxonomy category "${categoryName}" deleted successfully.` });
  } catch (error) {
    console.error('Delete Species Category Error:', error);
    res.status(500).json({ error: 'Server error deleting taxonomy category.' });
  }
};
