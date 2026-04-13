// MongoDB Memory Server setup — for integration tests
// Import this in integration/security test files that need a real DB
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

jest.setTimeout(120000);

let mongoServer;
const MONGOMS_VERSION = process.env.MONGOMS_VERSION || '7.0.14';

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({
    binary: {
      version: MONGOMS_VERSION,
    },
  });
  const mongoUri = mongoServer.getUri();
  process.env.MONGODB_URI = mongoUri;
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

afterEach(async () => {
  if (mongoose.connection.readyState !== 1) {
    return;
  }

  // Clean all collections after each test
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});
