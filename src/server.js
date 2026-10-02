const http = require('http');
const app = require('./app');
const env = require('./config/env');
const { connectDB, prisma } = require('./config/database');
const { initSocket } = require('./config/socket');

async function startServer() {
  await connectDB();

  let port = parseInt(env.PORT || '5000', 10);
  const host = '0.0.0.0';

  function listen(targetPort) {
    const server = http.createServer(app);
    initSocket(server);

    server.listen(targetPort, host, () => {
      console.log(`🚀 Agro Shop Backend running on: http://localhost:${targetPort}`);
      console.log(`💚 Health check endpoint: http://localhost:${targetPort}/health`);
      console.log(`📚 Swagger API Docs available at: http://localhost:${targetPort}/api-docs`);
      console.log(`🔌 Socket.IO Server initialized for real-time events`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`⚠️ Port ${targetPort} is in use, trying port ${targetPort + 1}...`);
        listen(targetPort + 1);
      } else {
        console.error('❌ Server startup error:', err);
      }
    });

    const gracefulShutdown = async (signal) => {
      console.log(`\n⚠️ Received ${signal}. Starting graceful shutdown...`);
      server.close(async () => {
        console.log('🔒 HTTP server closed.');
        await prisma.$disconnect();
        console.log('👋 Database connection disconnected. Shutdown complete.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  }

  listen(port);
}

startServer();
