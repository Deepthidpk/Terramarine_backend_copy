const db = require('../config/db');

// Get Notifications
exports.getNotifications = async (req, res) => {
  const user_id = req.user.user_id;

  try {
    const result = await db.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [user_id]
    );
    res.json({ notifications: result.rows });
  } catch (error) {
    console.error('Get Notifications Error:', error);
    res.status(500).json({ error: 'Server error retrieving notifications.' });
  }
};

// Mark Notification as Read
exports.markAsRead = async (req, res) => {
  const { id } = req.params; // notification_id
  const user_id = req.user.user_id;

  try {
    if (id) {
      await db.query(
        'UPDATE notifications SET is_read = TRUE WHERE notification_id = $1 AND user_id = $2',
        [id, user_id]
      );
    } else {
      await db.query(
        'UPDATE notifications SET is_read = TRUE WHERE user_id = $1',
        [user_id]
      );
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Mark Read Error:', error);
    res.status(500).json({ error: 'Server error updating notification status.' });
  }
};

// Clear All Notifications
exports.clearNotifications = async (req, res) => {
  const user_id = req.user.user_id;

  try {
    await db.query('DELETE FROM notifications WHERE user_id = $1', [user_id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Clear Notifications Error:', error);
    res.status(500).json({ error: 'Server error clearing notifications.' });
  }
};

// Delete Single Notification
exports.deleteNotification = async (req, res) => {
  const { id } = req.params;
  const user_id = req.user.user_id;

  try {
    await db.query('DELETE FROM notifications WHERE notification_id = $1 AND user_id = $2', [id, user_id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete Notification Error:', error);
    res.status(500).json({ error: 'Server error deleting notification.' });
  }
};
