const { PrismaClient } = require('@prisma/client');
const env = require('./env');

// Optimize connection parameters for Neon Serverless PostgreSQL & PgBouncer
let databaseUrl = process.env.DATABASE_URL;
if (databaseUrl && !databaseUrl.includes('connection_limit=')) {
  const separator = databaseUrl.includes('?') ? '&' : '?';
  databaseUrl = `${databaseUrl}${separator}connection_limit=5&connect_timeout=15&pool_timeout=30`;
}

const prisma = new PrismaClient({
  datasources: databaseUrl ? { db: { url: databaseUrl } } : undefined,
  transactionOptions: {
    maxWait: 15000, // 15 seconds max wait to acquire a connection from pool
    timeout: 30000, // 30 seconds max duration for interactive transactions
  },
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
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
