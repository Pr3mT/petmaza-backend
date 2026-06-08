import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const auditDb = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.error('❌ MONGODB_URI is not defined');
      process.exit(1);
    }

    await mongoose.connect(uri);
    const db = mongoose.connection.db!;
    console.log(`✅ Connected to DB: ${db.databaseName}\n`);

    const collections = await db.listCollections().toArray();
    const rows: { name: string; count: number }[] = [];

    for (const col of collections) {
      const count = await db.collection(col.name).countDocuments();
      rows.push({ name: col.name, count });
    }

    rows.sort((a, b) => a.name.localeCompare(b.name));

    console.log('Collection'.padEnd(36) + 'Docs');
    console.log('─'.repeat(46));
    for (const r of rows) {
      console.log(r.name.padEnd(36) + String(r.count).padStart(8));
    }
    console.log('─'.repeat(46));
    console.log('Total collections: ' + rows.length);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

auditDb();
