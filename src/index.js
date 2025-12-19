require('dotenv').config();
const http = require('http');
const jwt = require('jsonwebtoken');
const app = require('./app');
const connectDB = require('./config/db');
const realtimeActivityService = require('./utils/realtimeActivityService');
const User = require('./models/User');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 5001;

// Connect to database
connectDB().catch(err => {
  console.error('Database connection failed:', err.message);
  process.exit(1);
});

// Create HTTP server and attach Express app
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  maxHttpBufferSize: 1e6,
});

// Socket authentication & registration
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
    if (!token) return next(new Error('Authentication error'));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return next(new Error('Authentication error'));

    socket.user = { id: user._id.toString(), role: user.role, email: user.email };
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  const clientId = socket.id;
  const userId = socket.user?.id || null;

  // Register client with realtimeActivityService
  realtimeActivityService.registerClient(clientId, userId, (event, data) => {
    socket.emit(event, data);
  });

  socket.on('disconnect', () => {
    realtimeActivityService.unregisterClient(clientId);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
