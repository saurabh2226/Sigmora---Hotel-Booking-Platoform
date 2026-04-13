const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io;

const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Authenticate socket connections via JWT
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      socket.userId = null;
      return next();
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      socket.userId = decoded.id;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.userId || 'anonymous'}`);

    // User joins their personal room
    socket.on('join-user-room', () => {
      if (socket.userId) {
        socket.join(`user-${socket.userId}`);
      }
    });

    // Admin joins admin room
    socket.on('join-admin-room', () => {
      socket.join('admin-room');
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.userId || 'anonymous'}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};

// Emit to a specific user
const emitToUser = (userId, event, data) => {
  if (io) {
    io.to(`user-${userId}`).emit(event, data);
  }
};

// Emit to all admins
const emitToAdmins = (event, data) => {
  if (io) {
    io.to('admin-room').emit(event, data);
  }
};

// Broadcast availability update for a hotel
const emitAvailabilityUpdate = (hotelId, data) => {
  if (io) {
    io.emit(`availability:${hotelId}`, data);
  }
};

const emitHotelCatalogUpdate = (data = {}) => {
  if (io) {
    io.emit('hotel-catalog-updated', {
      updatedAt: new Date().toISOString(),
      ...data,
    });
  }
};

const emitHotelDetailUpdate = (hotelId, data = {}) => {
  if (io) {
    io.emit(`hotel-updated:${hotelId}`, {
      hotelId,
      updatedAt: new Date().toISOString(),
      ...data,
    });
  }
};

module.exports = {
  initializeSocket,
  getIO,
  emitToUser,
  emitToAdmins,
  emitAvailabilityUpdate,
  emitHotelCatalogUpdate,
  emitHotelDetailUpdate,
};
