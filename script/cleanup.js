const mongoose = require('mongoose');
require('dotenv').config();

async function cleanup() {
  try {
    // Use your MongoDB connection string
    await mongoose.connect(process.env.MONGODB_URI || 'your-connection-string');
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('registrations');

    // List current indexes
    const indexes = await collection.indexes();
    console.log('📋 Current indexes:', indexes.map(idx => idx.name));

    // Drop the orphaned index
    try {
      await collection.dropIndex('registrationId_1');
      console.log('✅ Successfully dropped registrationId_1 index');
    } catch (error) {
      if (error.code === 27) {
        console.log('ℹ️ Index registrationId_1 does not exist (already removed)');
      } else {
        throw error;
      }
    }

    await mongoose.disconnect();
    console.log('✅ Cleanup complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

cleanup(); 