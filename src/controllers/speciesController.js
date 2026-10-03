const db = require('../config/db');

// =========================================================================
// 1. Species Catalog & Review Workflow
// =========================================================================

// Get all marine species (Role-aware & status-filtered)
// CRITICAL RULE: By default only APPROVED species are returned for public/researchers
exports.getAllSpecies = async (req, res) => {
  try {
    const { approval_status, category, search } = req.query;
    
    let whereClauses = [];
    let queryParams = [];

    // Filter by approval status
    if (approval_status && approval_status !== 'all') {
      queryParams.push(approval_status);
      whereClauses.push(`s.approval_status = $${queryParams.length}`);
    } else if (!approval_status) {
      // Default: Only return approved species
      queryParams.push('Approved');
      whereClauses.push(`COALESCE(s.approval_status, 'Approved') = $${queryParams.length}`);
    }

    // Filter by category
    if (category && category !== 'All') {
      queryParams.push(category);
      whereClauses.push(`s.category = $${queryParams.length}`);
    }

    // Filter by search query
    if (search && search.trim()) {
      queryParams.push(`%${search.trim()}%`);
      const pIdx = queryParams.length;
      whereClauses.push(`(s.name ILIKE $${pIdx} OR s.scientific_name ILIKE $${pIdx} OR s.notes ILIKE $${pIdx})`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const query = `
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
        COALESCE(s.approval_status, 'Approved') as approval_status,
        s.rejection_reason,
        s.reviewed_by,
        s.reviewed_by_name,
        s.reviewed_at,
        s.created_by,
        s.created_by_name,
        s.created_at,
        u.full_name as author_name,
        u.email as author_email,
        u.role as author_role
      FROM species_catalog s
      LEFT JOIN users u ON s.created_by = u.user_id
      ${whereSql}
      ORDER BY 
        CASE WHEN s.approval_status = 'Pending' THEN 1 ELSE 2 END,
        s.created_at DESC, 
        s.species_id ASC
    `;

    const result = await db.query(query, queryParams);
    res.json({ species: result.rows });
  } catch (error) {
    console.error('Get All Species Error:', error);
    res.status(500).json({ error: 'Server error retrieving marine species catalog.' });
  }
};

// Get all species submissions for Municipal Authority Review
exports.getSpeciesSubmissions = async (req, res) => {
  try {
    const { status, category, search } = req.query;

    let whereClauses = [];
    let queryParams = [];

    if (status && status !== 'all') {
      queryParams.push(status);
      whereClauses.push(`COALESCE(s.approval_status, 'Approved') = $${queryParams.length}`);
    }

    if (category && category !== 'All') {
      queryParams.push(category);
      whereClauses.push(`s.category = $${queryParams.length}`);
    }

    if (search && search.trim()) {
      queryParams.push(`%${search.trim()}%`);
      const pIdx = queryParams.length;
      whereClauses.push(`(
        s.name ILIKE $${pIdx} OR 
        s.scientific_name ILIKE $${pIdx} OR 
        s.created_by_name ILIKE $${pIdx} OR 
        u.full_name ILIKE $${pIdx} OR 
        u.email ILIKE $${pIdx}
      )`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const query = `
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
        COALESCE(s.approval_status, 'Approved') as approval_status,
        s.rejection_reason,
        s.reviewed_by,
        s.reviewed_by_name,
        s.reviewed_at,
        s.created_by,
        s.created_by_name,
        s.created_at,
        u.full_name as author_name,
        u.email as author_email,
        u.role as author_role
      FROM species_catalog s
      LEFT JOIN users u ON s.created_by = u.user_id
      ${whereSql}
      ORDER BY 
        CASE WHEN s.approval_status = 'Pending' THEN 1 ELSE 2 END,
        s.created_at DESC
    `;

    const result = await db.query(query, queryParams);

    // Compute stats
    const statsQuery = await db.query(`
      SELECT 
        COUNT(*)::int as total,
        COUNT(CASE WHEN COALESCE(approval_status, 'Approved') = 'Pending' THEN 1 END)::int as pending,
        COUNT(CASE WHEN COALESCE(approval_status, 'Approved') = 'Approved' THEN 1 END)::int as approved,
        COUNT(CASE WHEN COALESCE(approval_status, 'Approved') = 'Rejected' THEN 1 END)::int as rejected
      FROM species_catalog
    `);

    res.json({ 
      submissions: result.rows,
      stats: statsQuery.rows[0]
    });
  } catch (error) {
    console.error('Get Species Submissions Error:', error);
    res.status(500).json({ error: 'Server error retrieving species submissions.' });
  }
};

// Get Researcher's own species submissions
exports.getMySubmissions = async (req, res) => {
  const userId = req.user?.user_id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

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
        COALESCE(s.approval_status, 'Approved') as approval_status,
        s.rejection_reason,
        s.reviewed_by_name,
        s.reviewed_at,
        s.created_at
      FROM species_catalog s
      WHERE s.created_by = $1
      ORDER BY s.created_at DESC
    `, [userId]);

    res.json({ submissions: result.rows });
  } catch (error) {
    console.error('Get My Submissions Error:', error);
    res.status(500).json({ error: 'Server error retrieving your species submissions.' });
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
        COALESCE(s.approval_status, 'Approved') as approval_status,
        s.rejection_reason,
        s.reviewed_by,
        s.reviewed_by_name,
        s.reviewed_at,
        s.created_by,
        s.created_by_name,
        s.created_at,
        u.full_name as author_name,
        u.email as author_email,
        u.role as author_role
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

// Create / Submit New Species (Authority, Researcher, Admin)
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
    if (trimmedHabitat.length > 500) {
      return res.status(400).json({ error: 'Typical habitat cannot exceed 500 characters.' });
    }
  }

  // 5. Threats validation if provided
  const trimmedThreats = (threats || '').trim();
  if (trimmedThreats) {
    if (trimmedThreats.length < 3) {
      return res.status(400).json({ error: 'Anthropogenic threats must be at least 3 characters long.' });
    }
    if (trimmedThreats.length > 500) {
      return res.status(400).json({ error: 'Anthropogenic threats cannot exceed 500 characters.' });
    }
  }

  // 6. Notes validation if provided
  const trimmedNotes = (notes || '').trim();
  if (trimmedNotes) {
    if (trimmedNotes.length < 5) {
      return res.status(400).json({ error: 'Research field notes must be at least 5 characters long.' });
    }
    if (trimmedNotes.length > 2000) {
      return res.status(400).json({ error: 'Research field notes cannot exceed 2000 characters.' });
    }
  }

  let imageUrl = image_url || null;
  if (req.file) {
    imageUrl = `/uploads/${req.file.filename}`;
  }

  const userId = req.user?.user_id || null;
  const userRole = req.user?.role || 'Researcher';
  const userName = req.user?.full_name || req.user?.name || 'Researcher';

  // If uploaded by Researcher, set status to 'Pending' for Municipal Authority approval
  // If uploaded directly by Authority or Admin, set status to 'Approved'
  const initialApprovalStatus = ['Authority', 'Admin'].includes(userRole) ? 'Approved' : 'Pending';

  try {
    const query = `
      INSERT INTO species_catalog 
      (name, scientific_name, category, status, habitat, threats, sensitivity, notes, image, created_by, created_by_name, approval_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
        approval_status,
        created_by,
        created_by_name,
        created_at
    `;
    const values = [
      trimmedName,
      finalScientificName,
      trimmedCat,
      status || 'Least Concern',
      trimmedHabitat || null,
      trimmedThreats || null,
      sensitivity || 'Medium',
      trimmedNotes || null,
      imageUrl,
      userId,
      userName,
      initialApprovalStatus
    ];

    const result = await db.query(query, values);

    // If researcher submitted, notify municipal authorities
    if (initialApprovalStatus === 'Pending') {
      try {
        const authorities = await db.query("SELECT user_id FROM users WHERE role = 'Authority' OR role = 'Admin'");
        for (const authUser of authorities.rows) {
          await db.query(`
            INSERT INTO notifications (user_id, title, message, reference_type, reference_id)
            VALUES ($1, $2, $3, $4, $5)
          `, [
            authUser.user_id,
            'New Species Submitted for Review',
            `Researcher ${userName} has submitted new species details for "${trimmedName}" (${finalScientificName}) awaiting your approval.`,
            'Species_Submission',
            result.rows[0].species_id
          ]);
        }
      } catch (notifErr) {
        console.warn('Could not dispatch authority notifications:', notifErr.message);
      }
    }

    const message = initialApprovalStatus === 'Pending'
      ? 'Species details submitted successfully! Awaiting Municipal Authority review and approval.'
      : 'Marine species registered and published to live catalog successfully!';

    res.status(201).json({ 
      message, 
      species: result.rows[0] 
    });
  } catch (error) {
    console.error('Create Species Error:', error);
    res.status(500).json({ error: 'Server error registering species.' });
  }
};

// Approve Species Submission (Municipal Authority, Admin)
exports.approveSpecies = async (req, res) => {
  const { id } = req.params;
  const reviewerId = req.user?.user_id;
  const reviewerName = req.user?.full_name || 'Municipal Authority Administrator';

  try {
    const check = await db.query('SELECT * FROM species_catalog WHERE species_id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Species submission record not found.' });
    }

    const species = check.rows[0];

    const updateQuery = `
      UPDATE species_catalog 
      SET 
        approval_status = 'Approved',
        rejection_reason = NULL,
        reviewed_by = $1,
        reviewed_by_name = $2,
        reviewed_at = CURRENT_TIMESTAMP
      WHERE species_id = $3
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
        approval_status,
        rejection_reason,
        reviewed_by,
        reviewed_by_name,
        reviewed_at,
        created_by,
        created_by_name,
        created_at
    `;

    const result = await db.query(updateQuery, [reviewerId, reviewerName, id]);

    // Send notification to the researcher who submitted it
    if (species.created_by) {
      try {
        await db.query(`
          INSERT INTO notifications (user_id, title, message, reference_type, reference_id)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          species.created_by,
          'Species Submission Approved! 🎉',
          `Your species submission for "${species.name}" (${species.scientific_name}) has been approved by the Municipal Authority and is now published in the Species Explorer catalog.`,
          'Species_Approved',
          id
        ]);
      } catch (notifErr) {
        console.warn('Notification error on species approval:', notifErr.message);
      }
    }

    res.json({
      message: `Species "${species.name}" has been approved and published to the Researcher Species Explorer.`,
      species: result.rows[0]
    });
  } catch (error) {
    console.error('Approve Species Error:', error);
    res.status(500).json({ error: 'Server error approving species.' });
  }
};

// Reject Species Submission (Municipal Authority, Admin)
exports.rejectSpecies = async (req, res) => {
  const { id } = req.params;
  const { reason, rejection_reason } = req.body;
  const reviewerId = req.user?.user_id;
  const reviewerName = req.user?.full_name || 'Municipal Authority Administrator';

  const feedback = (reason || rejection_reason || '').trim();
  if (!feedback) {
    return res.status(400).json({ error: 'Please provide a reason or constructive feedback for rejecting this species submission.' });
  }

  try {
    const check = await db.query('SELECT * FROM species_catalog WHERE species_id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Species submission record not found.' });
    }

    const species = check.rows[0];

    const updateQuery = `
      UPDATE species_catalog 
      SET 
        approval_status = 'Rejected',
        rejection_reason = $1,
        reviewed_by = $2,
        reviewed_by_name = $3,
        reviewed_at = CURRENT_TIMESTAMP
      WHERE species_id = $4
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
        approval_status,
        rejection_reason,
        reviewed_by,
        reviewed_by_name,
        reviewed_at,
        created_by,
        created_by_name,
        created_at
    `;

    const result = await db.query(updateQuery, [feedback, reviewerId, reviewerName, id]);

    // Send notification to the researcher who submitted it
    if (species.created_by) {
      try {
        await db.query(`
          INSERT INTO notifications (user_id, title, message, reference_type, reference_id)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          species.created_by,
          'Species Submission Update: Revision Required',
          `Your species submission for "${species.name}" was reviewed by the Municipal Authority with feedback: "${feedback}".`,
          'Species_Rejected',
          id
        ]);
      } catch (notifErr) {
        console.warn('Notification error on species rejection:', notifErr.message);
      }
    }

    res.json({
      message: `Species submission "${species.name}" marked as rejected with feedback provided.`,
      species: result.rows[0]
    });
  } catch (error) {
    console.error('Reject Species Error:', error);
    res.status(500).json({ error: 'Server error rejecting species.' });
  }
};

// Update Species (Authority, Admin)
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
    image_url,
    approval_status
  } = req.body;

  const finalScientificName = scientific_name || scientificName;

  const userRole = req.user?.role || 'Researcher';
  const userName = req.user?.full_name || req.user?.name || 'Researcher';

  try {
    const check = await db.query('SELECT * FROM species_catalog WHERE species_id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Species record not found.' });
    }

    const currentSpecies = check.rows[0];

    let imageUrl = currentSpecies.image;
    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    } else if (image_url !== undefined && image_url !== '') {
      imageUrl = image_url;
    }

    const newApprovalStatus = ['Authority', 'Admin'].includes(userRole)
      ? (approval_status || currentSpecies.approval_status || 'Approved')
      : 'Pending';

    const newRejectionReason = ['Authority', 'Admin'].includes(userRole)
      ? currentSpecies.rejection_reason
      : null; // Clear rejection reason when researcher resubmits

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
        image = COALESCE($9, image),
        approval_status = $10,
        rejection_reason = $11
      WHERE species_id = $12
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
        approval_status,
        rejection_reason,
        reviewed_by,
        reviewed_by_name,
        reviewed_at,
        created_by,
        created_by_name,
        created_at
    `;
    const values = [
      name ? name.trim() : null,
      finalScientificName ? finalScientificName.trim() : null,
      category ? category.trim() : null,
      status || null,
      habitat ? habitat.trim() : null,
      threats ? threats.trim() : null,
      sensitivity || null,
      notes ? notes.trim() : null,
      imageUrl,
      newApprovalStatus,
      newRejectionReason,
      id
    ];

    const result = await db.query(query, values);
    const updated = result.rows[0];

    // If researcher updated, notify authorities for review
    if (userRole === 'Researcher') {
      try {
        const authorities = await db.query("SELECT user_id FROM users WHERE role = 'Authority' OR role = 'Admin'");
        for (const authUser of authorities.rows) {
          await db.query(`
            INSERT INTO notifications (user_id, title, message, reference_type, reference_id)
            VALUES ($1, $2, $3, $4, $5)
          `, [
            authUser.user_id,
            'Species Submission Updated',
            `Researcher ${userName} has updated details for "${updated.name}" (${updated.scientificName}) awaiting review.`,
            'Species_Submission',
            id
          ]);
        }
      } catch (notifErr) {
        console.warn('Could not dispatch authority notifications:', notifErr.message);
      }
    }

    const message = userRole === 'Researcher'
      ? 'Species details updated successfully! Awaiting Municipal Authority review and approval.'
      : 'Marine species updated successfully!';

    res.json({ 
      message, 
      species: updated 
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
    res.json({ message: 'Marine species submission removed successfully.' });
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
  if (!/^[a-zA-Z\s]+$/.test(categoryName)) {
    return res.status(400).json({ error: 'Category name can only contain alphabet letters and spaces.' });
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
