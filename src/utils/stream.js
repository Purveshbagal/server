// Simple in-memory SSE broadcaster for development use
const clients = [];

function eventsHandler(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const clientId = Date.now();
  const newClient = { id: clientId, res };
  clients.push(newClient);

  req.on('close', () => {
    const idx = clients.findIndex(c => c.id === clientId);
    if (idx !== -1) clients.splice(idx, 1);
  });
}

function sendEvent(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  // Send to connected SSE clients
  clients.forEach(c => c.res.write(payload));

  // Also forward to realtime activity service (socket.io) if available
  try {
    const realtime = require('./realtimeActivityService');
    // broadcast to all connected clients; realtime service will handle filtering
    realtime.broadcast(event, data);
  } catch (e) {
    // ignore if realtime service not available
  }
}

module.exports = {
  eventsHandler,
  sendEvent,
};
