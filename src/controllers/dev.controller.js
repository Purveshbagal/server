const realtimeActivityService = require('../utils/realtimeActivityService');

// Dev-only endpoint: broadcast a test activity
const broadcastTestActivity = async (req, res, next) => {
  try {
    const {
      type = 'ORDER_PLACED',
      userId,
      description = 'Dev: sample activity',
      details = {},
      severity = 'INFO',
      status = 'COMPLETED',
      isPublic = true,
    } = req.body || {};

    const payload = {
      type,
      userId,
      description,
      details,
      severity,
      status,
      isPublic,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    };

    const activity = await realtimeActivityService.broadcastActivity(payload);

    res.json({ success: true, data: activity });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  broadcastTestActivity,
};
