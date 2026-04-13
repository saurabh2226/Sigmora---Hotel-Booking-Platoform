require('dotenv').config();
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const { connectSequelize } = require('./config/sequelize');
const { connectRedis } = require('./config/redis');
const { initializeSocket } = require('./socket/socketHandler');
const { migrateLegacyRoles } = require('./utils/roleMigration');

const PORT = process.env.PORT || 5000;
const AUTO_PORT_FALLBACK = process.env.AUTO_PORT_FALLBACK === 'true';
let activePort = Number(PORT);

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
initializeSocket(server);

// Connect to database and start server
const startServer = async () => {
  try {
    await connectDB();
    
    // Connect MySQL/Sequelize
    await connectSequelize({
      syncSchema: process.env.SQL_SCHEMA_SYNC !== 'false',
      alter: process.env.NODE_ENV !== 'production' && process.env.SQL_SCHEMA_ALTER === 'true',
      allowAlterFallback: true,
    });

    await migrateLegacyRoles();

    // Connect Redis for distributed booking locks when configured
    await connectRedis();

    const listenOnPort = (port) => {
      activePort = Number(port);

      server.once('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          if (AUTO_PORT_FALLBACK && port < 65535) {
            console.warn(`⚠️ Port ${port} is already in use. Trying ${port + 1}...`);
            listenOnPort(port + 1);
            return;
          }

          console.error(`\n❌ Port ${port} is already in use.`);
          console.error('   Fix: stop the existing process using port 5000, or set AUTO_PORT_FALLBACK=true to try the next port.');
          process.exit(1);
        }

        throw error;
      });

      server.listen(port, () => {
        console.log(`\n🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${port}`);
        console.log(`📡 API: http://localhost:${port}/api/v1`);
        console.log(`❤️  Health: http://localhost:${port}/api/health\n`);
      });
    };

    listenOnPort(activePort);

    // Initialize cron jobs in production/development (not test)
    if (process.env.NODE_ENV !== 'test') {
      try {
        require('./jobs/cleanupJob');
        require('./jobs/emailJob');
        console.log('⏰ Cron jobs initialized');
      } catch (err) {
        console.warn('Cron jobs initialization warning:', err.message);
      }
    }
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION:', err.message);
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err.message);
  process.exit(1);
});

startServer();

module.exports = server;
