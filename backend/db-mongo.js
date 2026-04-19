// MongoDB Connection & Collections Setup
const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/workspace_kz';
const client = new MongoClient(MONGO_URL);

let db = null;

async function connect() {
  try {
    await client.connect();
    db = client.db('workspace_kz');
    console.log('✅ MongoDB connected');
    await initCollections();
    return db;
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  }
}

async function initCollections() {
  const collections = ['users', 'rooms', 'bookings'];
  for (const name of collections) {
    const exists = await db.listCollections({ name }).hasNext();
    if (!exists) {
      await db.createCollection(name);
      console.log(`✓ Created collection: ${name}`);
    }
  }
  
  // Create indexes
  await db.collection('users').createIndex({ email: 1 }, { unique: true });
  await db.collection('bookings').createIndex({ room_id: 1, booking_date: 1, status: 1 });
  await db.collection('rooms').createIndex({ owner_email: 1 });
}

async function seedAdmin() {
  const bcrypt = require('bcryptjs');
  const users = db.collection('users');
  
  const admin = await users.findOne({ email: 'admin@workspace.kz' });
  if (!admin) {
    const hash = bcrypt.hashSync('admin2024', 10);
    await users.insertOne({
      email: 'admin@workspace.kz',
      password_hash: hash,
      name: 'Админ',
      phone: '+7 700 000 0001',
      role: 'admin',
      joined: new Date(),
      created_at: new Date()
    });
    console.log('✓ Admin user seeded');
  }
}

// Get connection
function getDB() {
  if (!db) {
    throw new Error('Database not connected');
  }
  return db;
}

// Query wrapper for compatibility
const query = async (sql, params = []) => {
  // This is a placeholder. For MongoDB, use direct collection methods instead.
  throw new Error('Use db.collection() directly for MongoDB');
};

module.exports = {
  connect,
  getDB,
  query,
  seedAdmin,
  client
};
