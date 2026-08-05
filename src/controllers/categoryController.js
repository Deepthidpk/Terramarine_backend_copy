const db = require('../config/db');

// 1. Get All Categories
exports.getCategories = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM report_categories ORDER BY name ASC');
    res.json({ categories: result.rows });
  } catch (error) {
    console.error('Get Categories Error:', error);
    res.status(500).json({ error: 'Server error retrieving categories.' });
  }
};

// 2. Add New Category (Authority / Admin only)
exports.addCategory = async (req, res) => {
  const { name, description } = req.body;
  const userRole = req.user?.role;
  const userId = req.user?.user_id;

  // Strict check: Only Authority (or Admin) can add new categories
  if (userRole !== 'Authority' && userRole !== 'Admin') {
    return res.status(403).json({ error: 'Access denied. Only Municipal Authorities can add new categories.' });
  }

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Category name is required.' });
  }

  const trimmedName = name.trim();
  if (trimmedName.length < 2 || trimmedName.length > 100) {
    return res.status(400).json({ error: 'Category name must be between 2 and 100 characters.' });
  }

  try {
    // Check case-insensitive duplicate
    const checkCat = await db.query(
      'SELECT category_id FROM report_categories WHERE LOWER(TRIM(name)) = LOWER($1)',
      [trimmedName]
    );

    if (checkCat.rows.length > 0) {
      return res.status(400).json({ error: 'Category already exists.' });
    }

    const insertQuery = `
      INSERT INTO report_categories (name, description, created_by)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const result = await db.query(insertQuery, [
      trimmedName,
      description ? description.trim() : null,
      userId
    ]);

    const newCategory = result.rows[0];

    // Audit log
    await db.query(
      `INSERT INTO system_audit_logs (user_id, user_email, action, details)
       VALUES ($1, $2, $3, $4)`,
      [userId, req.user.email, 'CREATE_REPORT_CATEGORY', `Added new report category: ${trimmedName}`]
    ).catch(err => console.error('Audit Log Error:', err.message));

    res.status(201).json({
      message: 'New report category created successfully.',
      category: newCategory
    });
  } catch (error) {
    console.error('Add Category Error:', error);
    res.status(500).json({ error: 'Server error creating report category.' });
  }
};

// 3. Get All Waste Types
exports.getWasteTypes = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM waste_types ORDER BY name ASC');
    res.json({ wasteTypes: result.rows });
  } catch (error) {
    console.error('Get Waste Types Error:', error);
    res.status(500).json({ error: 'Server error retrieving waste types.' });
  }
};

// 4. Add New Waste Type (Authority / Admin only)
exports.addWasteType = async (req, res) => {
  const { name, description } = req.body;
  const userRole = req.user?.role;
  const userId = req.user?.user_id;

  // Strict check: Only Authority (or Admin) can add new waste types
  if (userRole !== 'Authority' && userRole !== 'Admin') {
    return res.status(403).json({ error: 'Access denied. Only Municipal Authorities can add new waste types.' });
  }

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Waste type name is required.' });
  }

  const trimmedName = name.trim();
  if (trimmedName.length < 2 || trimmedName.length > 100) {
    return res.status(400).json({ error: 'Waste type name must be between 2 and 100 characters.' });
  }

  try {
    // Check case-insensitive duplicate
    const checkWaste = await db.query(
      'SELECT waste_type_id FROM waste_types WHERE LOWER(TRIM(name)) = LOWER($1)',
      [trimmedName]
    );

    if (checkWaste.rows.length > 0) {
      return res.status(400).json({ error: 'Waste type already exists.' });
    }

    const insertQuery = `
      INSERT INTO waste_types (name, description, created_by)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const result = await db.query(insertQuery, [
      trimmedName,
      description ? description.trim() : null,
      userId
    ]);

    const newWasteType = result.rows[0];

    // Audit log
    await db.query(
      `INSERT INTO system_audit_logs (user_id, user_email, action, details)
       VALUES ($1, $2, $3, $4)`,
      [userId, req.user.email, 'CREATE_WASTE_TYPE', `Added new waste type: ${trimmedName}`]
    ).catch(err => console.error('Audit Log Error:', err.message));

    res.status(201).json({
      message: 'New waste type created successfully.',
      wasteType: newWasteType
    });
  } catch (error) {
    console.error('Add Waste Type Error:', error);
    res.status(500).json({ error: 'Server error creating waste type.' });
  }
};

// 5. Delete Category (Authority / Admin only)
exports.deleteCategory = async (req, res) => {
  const { id } = req.params;
  const userRole = req.user?.role;
  const userId = req.user?.user_id;

  if (userRole !== 'Authority' && userRole !== 'Admin') {
    return res.status(403).json({ error: 'Access denied. Only Municipal Authorities can delete categories.' });
  }

  try {
    const checkCat = await db.query(
      'SELECT category_id, name FROM report_categories WHERE category_id::text = $1 OR LOWER(name) = LOWER($1)',
      [id]
    );

    if (checkCat.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found.' });
    }

    const catToDelete = checkCat.rows[0];

    await db.query('DELETE FROM report_categories WHERE category_id = $1', [catToDelete.category_id]);

    await db.query(
      `INSERT INTO system_audit_logs (user_id, user_email, action, details)
       VALUES ($1, $2, $3, $4)`,
      [userId, req.user.email, 'DELETE_REPORT_CATEGORY', `Deleted report category: ${catToDelete.name}`]
    ).catch(err => console.error('Audit Log Error:', err.message));

    res.json({ message: `Category "${catToDelete.name}" deleted successfully.` });
  } catch (error) {
    console.error('Delete Category Error:', error);
    res.status(500).json({ error: 'Server error deleting category.' });
  }
};

// 6. Delete Waste Type (Authority / Admin only)
exports.deleteWasteType = async (req, res) => {
  const { id } = req.params;
  const userRole = req.user?.role;
  const userId = req.user?.user_id;

  if (userRole !== 'Authority' && userRole !== 'Admin') {
    return res.status(403).json({ error: 'Access denied. Only Municipal Authorities can delete waste types.' });
  }

  try {
    const checkWaste = await db.query(
      'SELECT waste_type_id, name FROM waste_types WHERE waste_type_id::text = $1 OR LOWER(name) = LOWER($1)',
      [id]
    );

    if (checkWaste.rows.length === 0) {
      return res.status(404).json({ error: 'Waste type not found.' });
    }

    const wasteToDelete = checkWaste.rows[0];

    await db.query('DELETE FROM waste_types WHERE waste_type_id = $1', [wasteToDelete.waste_type_id]);

    await db.query(
      `INSERT INTO system_audit_logs (user_id, user_email, action, details)
       VALUES ($1, $2, $3, $4)`,
      [userId, req.user.email, 'DELETE_WASTE_TYPE', `Deleted waste type: ${wasteToDelete.name}`]
    ).catch(err => console.error('Audit Log Error:', err.message));

    res.json({ message: `Waste type "${wasteToDelete.name}" deleted successfully.` });
  } catch (error) {
    console.error('Delete Waste Type Error:', error);
    res.status(500).json({ error: 'Server error deleting waste type.' });
  }
};
