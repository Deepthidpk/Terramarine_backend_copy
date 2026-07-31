const db = require('../config/db');

// Create Task (Authority only)
exports.createTask = async (req, res) => {
  const { report_id, campaign_id, assigned_worker, deadline } = req.body;

  if (!report_id) {
    return res.status(400).json({ error: 'Report ID is required.' });
  }

  try {
    // Check if report exists
    const reportCheck = await db.query('SELECT status, title, before_image, image_url FROM pollution_reports WHERE report_id = $1', [report_id]);
    if (reportCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Pollution report not found.' });
    }

    const report = reportCheck.rows[0];
    const beforeImage = report.image_url;

    // Check if task already exists for this report
    const taskCheck = await db.query('SELECT task_id FROM cleanup_tasks WHERE report_id = $1', [report_id]);
    if (taskCheck.rows.length > 0) {
      return res.status(400).json({ error: 'A cleanup task is already assigned to this report.' });
    }

    // Insert task
    const insertQuery = `
      INSERT INTO cleanup_tasks 
      (report_id, campaign_id, assigned_worker, assigned_date, deadline, status, before_image) 
      VALUES ($1, $2, $3, NOW(), $4, 'Pending', $5) 
      RETURNING *
    `;
    const result = await db.query(insertQuery, [
      report_id,
      campaign_id || null,
      assigned_worker || null,
      deadline || null,
      beforeImage
    ]);

    const newTask = result.rows[0];

    // If assigned to worker, send notification
    if (assigned_worker) {
      await db.query(
        `INSERT INTO notifications (user_id, title, message, reference_type, reference_id)
         VALUES ($1, 'New Task Assigned', 'You have been assigned the cleanup task: ' || $2, 'PollutionReport', $3)`,
        [assigned_worker, report.title, report_id]
      );
    }

    res.status(201).json({ task: newTask });
  } catch (error) {
    console.error('Create Task Error:', error);
    res.status(500).json({ error: 'Server error creating cleanup task.' });
  }
};

// Get Tasks (Filterable)
exports.getTasks = async (req, res) => {
  const { role, user_id } = req.user;
  const { status } = req.query;

  let queryText = `
    SELECT t.*, r.title as report_title, r.location_name, r.latitude, r.longitude, r.waste_type,
           u.full_name as worker_name, c.campaign_name
    FROM cleanup_tasks t
    JOIN pollution_reports r ON t.report_id = r.report_id
    LEFT JOIN users u ON t.assigned_worker = u.user_id
    LEFT JOIN cleanup_campaigns c ON t.campaign_id = c.campaign_id
    WHERE 1=1
  `;
  const params = [];

  // Volunteers only see their own tasks
  if (role === 'Volunteer') {
    params.push(user_id);
    queryText += ` AND t.assigned_worker = $${params.length}`;
  }

  if (status) {
    params.push(status);
    queryText += ` AND t.status = $${params.length}`;
  }

  queryText += ' ORDER BY t.assigned_date DESC';

  try {
    const result = await db.query(queryText, params);
    res.json({ tasks: result.rows });
  } catch (error) {
    console.error('Get Tasks Error:', error);
    res.status(500).json({ error: 'Server error retrieving tasks.' });
  }
};

// Get Task Details
exports.getTaskById = async (req, res) => {
  const { id } = req.params;

  try {
    const queryText = `
      SELECT t.*, r.title as report_title, r.description as report_description, r.location_name, r.latitude, r.longitude, r.waste_type, r.severity,
             u.full_name as worker_name, u.email as worker_email, c.campaign_name
      FROM cleanup_tasks t
      JOIN pollution_reports r ON t.report_id = r.report_id
      LEFT JOIN users u ON t.assigned_worker = u.user_id
      LEFT JOIN cleanup_campaigns c ON t.campaign_id = c.campaign_id
      WHERE t.task_id = $1
    `;
    const result = await db.query(queryText, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    res.json({ task: result.rows[0] });
  } catch (error) {
    console.error('Get Task Details Error:', error);
    res.status(500).json({ error: 'Server error retrieving task details.' });
  }
};

// Update Task Status & Upload Proof (Volunteer or Authority)
exports.updateTaskStatus = async (req, res) => {
  const { id } = req.params;
  const { status, completion_notes } = req.body;
  const user_id = req.user.user_id;
  const user_role = req.user.role;

  if (!status) {
    return res.status(400).json({ error: 'Status is required.' });
  }

  try {
    const taskResult = await db.query('SELECT * FROM cleanup_tasks WHERE task_id = $1', [id]);
    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const task = taskResult.rows[0];

    // Auth validation
    if (user_role === 'Volunteer' && task.assigned_worker !== user_id) {
      return res.status(403).json({ error: 'You are not assigned to this task.' });
    }

    let afterImage = task.after_image;
    if (req.file) {
      afterImage = `/uploads/${req.file.filename}`;
    }

    let completedDate = task.completed_date;
    if (status === 'Completed' && task.status !== 'Completed') {
      completedDate = new Date();
    }

    // Update query
    const updateQuery = `
      UPDATE cleanup_tasks 
      SET status = $1, 
          after_image = COALESCE($2, after_image), 
          completion_notes = COALESCE($3, completion_notes), 
          completed_date = COALESCE($4, completed_date) 
      WHERE task_id = $5 
      RETURNING *
    `;
    const result = await db.query(updateQuery, [
      status, 
      afterImage || null, 
      completion_notes || null, 
      completedDate || null, 
      id
    ]);

    const updatedTask = result.rows[0];

    // If verified by Authority, trigger report completion and worker payments
    if (status === 'Verified' && task.status !== 'Verified') {
      // Mark original report as Completed
      await db.query(
        "UPDATE pollution_reports SET status = 'Completed', completed_at = NOW() WHERE report_id = $1",
        [task.report_id]
      );

      // Log status audit for report
      await db.query(
        `INSERT INTO report_updates (report_id, updated_by, old_status, new_status, remarks)
         VALUES ($1, $2, 'Verified', 'Completed', 'Task verified by municipal authority')`,
        [task.report_id, user_id]
      );

      // Trigger volunteer payment if worker is assigned and campaign exists
      if (task.assigned_worker && task.campaign_id) {
        // Create payment entry of default amount e.g. 500.00
        const paymentCheck = await db.query(
          'SELECT payment_id FROM payments WHERE volunteer_id = $1 AND campaign_id = $2',
          [task.assigned_worker, task.campaign_id]
        );

        if (paymentCheck.rows.length === 0) {
          await db.query(
            `INSERT INTO payments (volunteer_id, campaign_id, amount, payment_status)
             VALUES ($1, $2, 500.00, 'Pending')`,
            [task.assigned_worker, task.campaign_id]
          );

          // Notify worker
          await db.query(
            `INSERT INTO notifications (user_id, title, message)
             VALUES ($1, 'Payment Pending', 'A clean-up reward of ₹500 is pending verification for your task.')`,
            [task.assigned_worker]
          );
        }
      }
    }

    // Notify Authority if worker completed the task
    if (status === 'Completed') {
      await db.query(
        `INSERT INTO notifications (user_id, title, message, reference_type, reference_id)
         SELECT user_id, 'Task Completed by Volunteer', 'Task for report has been submitted with clean-up proof.', 'PollutionReport', $1
         FROM users WHERE role = 'Authority'`,
        [task.report_id]
      );
    }

    res.json({ task: updatedTask });
  } catch (error) {
    console.error('Update Task Error:', error);
    res.status(500).json({ error: 'Server error updating task.' });
  }
};
