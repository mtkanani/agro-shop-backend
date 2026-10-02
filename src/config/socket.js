let io = null;

function initSocket(server) {
  const { Server } = require('socket.io');
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`🔌 [Socket.IO] Client connected: ${socket.id}`);

    socket.on('join_shop', (shopId) => {
      if (shopId) {
        const room = `shop_${shopId}`;
        socket.join(room);
        console.log(`🏠 [Socket.IO] Socket ${socket.id} joined room ${room}`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`❌ [Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

function getIO() {
  return io;
}

function emitShopEvent(shopId, eventName, payload) {
  if (io && shopId) {
    const room = `shop_${shopId}`;
    io.to(room).emit(eventName, payload);
    console.log(`📡 [Socket.IO Event] Broadcasted '${eventName}' to room '${room}'`);
  }
}

module.exports = {
  initSocket,
  getIO,
  emitShopEvent,
};
