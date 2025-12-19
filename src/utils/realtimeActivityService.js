const EventEmitter = require('events');
const ActivityTracker = require('./activityTracker');
const logger = require('./logger');

class RealtimeActivityService extends EventEmitter {
  constructor() {
    super();
    this.connectedClients = new Map();
    this.activityQueue = [];
    this.maxQueueSize = 1000;
    this.setMaxListeners(50);
  }

  // Register a client connection
  registerClient(clientId, userId, socketEmitter) {
    this.connectedClients.set(clientId, {
      userId,
      socketEmitter,
      connectedAt: new Date(),
    });

    logger.info('Client registered for real-time updates', {
      clientId,
      userId,
      totalClients: this.connectedClients.size,
    });

    return clientId;
  }

  // Unregister a client connection
  unregisterClient(clientId) {
    this.connectedClients.delete(clientId);

    logger.info('Client unregistered', {
      clientId,
      totalClients: this.connectedClients.size,
    });
  }

  // Track and broadcast activity
  async broadcastActivity(activityOptions) {
    try {
      // Track the activity
      const activity = await ActivityTracker.trackActivity(activityOptions);

      // Add to queue
      this.activityQueue.push({
        ...activity.toObject(),
        broadcastedAt: new Date(),
      });

      // Maintain queue size
      if (this.activityQueue.length > this.maxQueueSize) {
        this.activityQueue.shift();
      }

      // Broadcast to connected clients
      this.broadcast('activity', activity, activityOptions.userId);

      // Emit event for subscribers
      this.emit('activity:created', activity);

      logger.debug('Activity broadcasted', {
        type: activityOptions.type,
        connectedClients: this.connectedClients.size,
      });

      return activity;
    } catch (error) {
      logger.error('Error broadcasting activity', {
        error: error.message,
        type: activityOptions?.type,
      });
      throw error;
    }
  }

  // Broadcast to specific client
  broadcastToClient(clientId, event, data) {
    const client = this.connectedClients.get(clientId);

    if (client && client.socketEmitter) {
      try {
        client.socketEmitter(event, data);
      } catch (error) {
        logger.error('Error sending to client', {
          error: error.message,
          clientId,
          event,
        });
      }
    }
  }

  // Broadcast to all connected clients
  broadcast(event, data, excludeUserId = null) {
    let broadcastCount = 0;

    for (const [clientId, client] of this.connectedClients.entries()) {
      if (excludeUserId && client.userId === excludeUserId) {
        continue;
      }

      try {
        client.socketEmitter(event, {
          data,
          timestamp: new Date(),
        });
        broadcastCount++;
      } catch (error) {
        logger.error('Error broadcasting to client', {
          error: error.message,
          clientId,
        });
      }
    }

    logger.debug(`Broadcast to ${broadcastCount} clients`, {
      event,
      totalClients: this.connectedClients.size,
    });
  }

  // Broadcast to specific user's sessions
  broadcastToUser(userId, event, data) {
    let broadcastCount = 0;

    for (const [clientId, client] of this.connectedClients.entries()) {
      if (client.userId === userId) {
        try {
          client.socketEmitter(event, {
            data,
            timestamp: new Date(),
          });
          broadcastCount++;
        } catch (error) {
          logger.error('Error broadcasting to user', {
            error: error.message,
            clientId,
            userId,
          });
        }
      }
    }

    return broadcastCount;
  }

  // Broadcast to admins only
  broadcastToAdmins(event, data) {
    let broadcastCount = 0;

    for (const [clientId, client] of this.connectedClients.entries()) {
      // In real implementation, check if user is admin
      try {
        client.socketEmitter(event, {
          data,
          timestamp: new Date(),
        });
        broadcastCount++;
      } catch (error) {
        logger.error('Error broadcasting to admin', {
          error: error.message,
          clientId,
        });
      }
    }

    return broadcastCount;
  }

  // Get recent activity history
  getRecentActivities(limit = 50) {
    return this.activityQueue.slice(-limit).reverse();
  }

  // Get client count
  getClientCount() {
    return this.connectedClients.size;
  }

  // Get client details
  getClientDetails(clientId) {
    return this.connectedClients.get(clientId);
  }

  // Get all connected clients info
  getAllClientsInfo() {
    const clients = [];

    for (const [clientId, client] of this.connectedClients.entries()) {
      clients.push({
        clientId,
        userId: client.userId,
        connectedAt: client.connectedAt,
        connectionDuration: new Date() - client.connectedAt,
      });
    }

    return clients;
  }

  // Track performance metrics
  getMetrics() {
    return {
      connectedClients: this.connectedClients.size,
      queuedActivities: this.activityQueue.length,
      maxQueueSize: this.maxQueueSize,
      listeners: this.listenerCount(),
    };
  }
}

// Export singleton instance
module.exports = new RealtimeActivityService();
