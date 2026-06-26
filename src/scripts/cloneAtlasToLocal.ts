import mongoose, { Connection } from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const ATLAS_URI = process.env.MONGODB_URI!;
const LOCAL_URI = process.env.LOCAL_MONGODB_URI || 'mongodb://localhost:27017/pet-marketplace';

async function cloneCollection(
  sourceConn: Connection,
  targetConn: Connection,
  collectionName: string
): Promise<number> {
  const sourceCollection = sourceConn.collection(collectionName);
  const targetCollection = targetConn.collection(collectionName);

  const docs = await sourceCollection.find({}).toArray();
  if (docs.length === 0) return 0;

  await targetCollection.deleteMany({});
  await targetCollection.insertMany(docs, { ordered: false });
  return docs.length;
}

async function cloneAtlasToLocal() {
  console.log('=== Petmaza Atlas → Local MongoDB Clone ===\n');

  if (!ATLAS_URI) {
    console.error('MONGODB_URI is not set in .env');
    process.exit(1);
  }

  console.log('Connecting to Atlas (source)...');
  const sourceConn = await mongoose.createConnection(ATLAS_URI, {
    serverSelectionTimeoutMS: 10000,
  }).asPromise();
  console.log('Connected to Atlas\n');

  console.log(`Connecting to local MongoDB at ${LOCAL_URI}...`);
  const targetConn = await mongoose.createConnection(LOCAL_URI, {
    serverSelectionTimeoutMS: 10000,
  }).asPromise();
  console.log('Connected to local MongoDB\n');

  const sourceDb = sourceConn.db!;
  const collections = await sourceDb.listCollections().toArray();
  const collectionNames = collections.map((c) => c.name);

  console.log(`Found ${collectionNames.length} collections: ${collectionNames.join(', ')}\n`);

  let totalDocs = 0;
  for (const name of collectionNames) {
    process.stdout.write(`Cloning "${name}"... `);
    try {
      const count = await cloneCollection(sourceConn, targetConn, name);
      console.log(`${count} documents`);
      totalDocs += count;
    } catch (err: any) {
      console.log(`ERROR: ${err.message}`);
    }
  }

  console.log(`\nDone! Cloned ${totalDocs} documents across ${collectionNames.length} collections.`);
  console.log(`\nLocal DB is ready at: ${LOCAL_URI}`);
  console.log('Update your .env: set MONGODB_URI=mongodb://localhost:27017/pet-marketplace\n');

  await sourceConn.close();
  await targetConn.close();
  process.exit(0);
}

cloneAtlasToLocal().catch((err) => {
  console.error('Clone failed:', err);
  process.exit(1);
});
