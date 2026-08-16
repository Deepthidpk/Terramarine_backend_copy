const db = require('../config/db');
const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id: 'rzp_test_TOWAtMyDyvL0n9',
  key_secret: 'WYcaQwUY5gSj1GL1eYUTfGye',
});


// Helper to sync payments for all Verified tasks
const syncVerifiedTaskPayments = async () => {
  try {
    const verifiedTasks = await db.query(
      `SELECT t.task_id, t.assigned_worker, t.campaign_id 
       FROM cleanup_tasks t 
       WHERE t.status IN ('Verified', 'Completed') AND t.assigned_worker IS NOT NULL`
    );

    for (const task of verifiedTasks.rows) {
      if (!task.assigned_worker) continue;
      const workerIds = task.assigned_worker.split(',').map(id => id.trim()).filter(Boolean);

      for (const wId of workerIds) {
        const userCheck = await db.query('SELECT user_id FROM users WHERE user_id::text = $1', [wId]);
        if (userCheck.rows.length === 0) continue;

        const payCheck = await db.query(
          'SELECT payment_id FROM payments WHERE volunteer_id::text = $1 AND (task_id = $2 OR (task_id IS NULL AND campaign_id IS NOT NULL AND campaign_id = $3))',
          [wId, task.task_id, task.campaign_id]
        );

        if (payCheck.rows.length === 0) {
          await db.query(
            `INSERT INTO payments (volunteer_id, campaign_id, task_id, amount, payment_status)
             VALUES ($1, $2, $3, 500.00, 'Pending')`,
            [wId, task.campaign_id || null, task.task_id]
          );

          await db.query(
            `INSERT INTO notifications (user_id, title, message)
             VALUES ($1, 'Payment Pending', 'A clean-up reward of ₹500 is pending payout verification for your task.')`,
            [wId]
          );
        }
      }
    }
  } catch (err) {
    console.error('Error syncing verified task payments:', err.message);
  }
};

// Get Payments
exports.getPayments = async (req, res) => {
  const { role, user_id } = req.user;

  // Auto-sync payments for any verified tasks
  await syncVerifiedTaskPayments();

  let queryText = `
    SELECT p.*, u.full_name as volunteer_name, u.email as volunteer_email,
           COALESCE(c.campaign_name, r.title, 'Direct Municipal Cleanup Task') as campaign_name,
           COALESCE(c.location, r.location_name, 'Coastal Incident Site') as campaign_location
    FROM payments p
    JOIN users u ON p.volunteer_id = u.user_id
    LEFT JOIN cleanup_campaigns c ON p.campaign_id = c.campaign_id
    LEFT JOIN cleanup_tasks t ON p.task_id = t.task_id
    LEFT JOIN pollution_reports r ON t.report_id = r.report_id
    WHERE 1=1
  `;
  const params = [];

  if (['Volunteer', 'Worker'].includes(role)) {
    params.push(user_id);
    queryText += ` AND p.volunteer_id = $${params.length}`;
  }

  queryText += ' ORDER BY p.payment_status DESC, p.payment_date DESC';

  try {
    const result = await db.query(queryText, params);
    res.json({ payments: result.rows });
  } catch (error) {
    console.error('Get Payments Error:', error);
    res.status(500).json({ error: 'Server error retrieving payment logs.' });
  }
};

// Process Payment (Authority/Admin only)
exports.processPayment = async (req, res) => {
  const { id } = req.params; // payment_id
  const { payment_method, transaction_ref } = req.body;

  if (!payment_method || !transaction_ref) {
    return res.status(400).json({ error: 'Payment method and transaction reference are required.' });
  }

  try {
    const paymentCheck = await db.query('SELECT * FROM payments WHERE payment_id = $1', [id]);
    if (paymentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Payment record not found.' });
    }

    const updateQuery = `
      UPDATE payments 
      SET payment_status = 'Paid', 
          payment_method = $1, 
          transaction_ref = $2, 
          payment_date = NOW() 
      WHERE payment_id = $3 
      RETURNING *
    `;
    const result = await db.query(updateQuery, [payment_method, transaction_ref, id]);
    const updatedPayment = result.rows[0];

    // Notify Worker / Volunteer
    await db.query(
      `INSERT INTO notifications (user_id, title, message, reference_type, reference_id)
       VALUES ($1, 'Payment Processed', 'Your clean-up reward payment of ₹' || $2 || ' has been processed successfully via ' || $3 || '. Ref: ' || $4, 'Payment', $5)`,
      [updatedPayment.volunteer_id, updatedPayment.amount, payment_method, transaction_ref, id]
    );

    res.json({ payment: updatedPayment });
  } catch (error) {
    console.error('Process Payment Error:', error);
    res.status(500).json({ error: 'Server error processing payment.' });
  }
};

// Create Razorpay Order
exports.createOrder = async (req, res) => {
  const { id } = req.params; // payment_id

  try {
    const paymentCheck = await db.query('SELECT amount FROM payments WHERE payment_id = $1', [id]);
    if (paymentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Payment record not found.' });
    }

    const amount = paymentCheck.rows[0].amount;
    const amountInPaise = Math.round(parseFloat(amount) * 100);

    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt: id.toString()
    };

    const order = await razorpay.orders.create(options);
    res.json({ order, key_id: 'rzp_test_TOWAtMyDyvL0n9' });
  } catch (error) {
    console.error('Create Order Error:', error);
    res.status(500).json({ error: 'Server error creating Razorpay order.' });
  }
};
