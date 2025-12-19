const Notification = require('../models/Notification');

// Fetch notifications (admins see admin notifications + all; users see their own)
const getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const query = {};

    if (req.user.role === 'admin') {
      // Admins see notifications flagged for admins plus any generic
      query.$or = [{ forAdmins: true }, { user: req.user.id }];
    } else {
      query.user = req.user.id;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((page - 1) * limit);

    res.json({ notifications });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch notifications' });
  }
};

// Mark notification(s) as read
const markRead = async (req, res) => {
  try {
    const { id } = req.params;
    if (id === 'all') {
      const q = req.user.role === 'admin' ? { forAdmins: true } : { user: req.user.id };
      await Notification.updateMany(q, { $set: { read: true } });
      return res.json({ ok: true });
    }

    await Notification.findByIdAndUpdate(id, { $set: { read: true } });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update notification' });
  }
};

module.exports = { getNotifications, markRead };
