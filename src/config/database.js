const { PrismaClient } = require('@prisma/client');
const env = require('./env');

const prisma = new PrismaClient({
  transactionOptions: {
    maxWait: 15000, // 15 seconds max wait to acquire a connection from pool
    timeout: 30000, // 30 seconds max duration for interactive transactions
  },
  log: env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

async function connectDB() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully via Prisma');
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    process.exit(1);
  }
}

module.exports = {
  prisma,
  connectDB,
};
