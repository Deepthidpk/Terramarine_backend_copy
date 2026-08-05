const db = require('../config/db');

// Get Payments
exports.getPayments = async (req, res) => {
  const { role, user_id } = req.user;

  let queryText = `
    SELECT p.*, u.full_name as volunteer_name, u.email as volunteer_email,
           c.campaign_name, c.location as campaign_location
    FROM payments p
    JOIN users u ON p.volunteer_id = u.user_id
    JOIN cleanup_campaigns c ON p.campaign_id = c.campaign_id
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

    // Notify Volunteer
    await db.query(
      `INSERT INTO notifications (user_id, title, message)
       VALUES ($1, 'Payment Disbursed', 'Your reward of ₹' || $2 || ' has been processed via ' || $3 || '. Ref: ' || $4)`,
      [updatedPayment.volunteer_id, updatedPayment.amount, payment_method, transaction_ref]
    );

    res.json({ payment: updatedPayment });
  } catch (error) {
    console.error('Process Payment Error:', error);
    res.status(500).json({ error: 'Server error processing payment.' });
  }
};
