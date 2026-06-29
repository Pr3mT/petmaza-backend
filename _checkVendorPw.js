/* eslint-disable */
require('dotenv').config();
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

(async () => {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db();
    const v = await db.collection('users').findOne(
      { email: 'bangalorebird@gmail.com' },
      { projection: { name: 1, email: 1, phone: 1, role: 1, password: 1, createdAt: 1 } }
    );
    if (!v) { console.log('VENDOR NOT FOUND'); return; }
    const candidates = ['Password123!', 'password', 'Password@123', '12345678', 'bangalorebird'];
    const results = {};
    for (const c of candidates) {
      try { results[c] = v.password ? await bcrypt.compare(c, v.password) : 'no-hash'; }
      catch (e) { results[c] = 'err:' + e.message; }
    }
    console.log(JSON.stringify({
      name: v.name, email: v.email, phone: v.phone, role: v.role,
      createdAt: v.createdAt, hasPasswordHash: !!v.password,
      hashPrefix: v.password ? v.password.slice(0, 7) : null,
      defaultPwMatches: results
    }, null, 2));
  } finally { await client.close(); }
})().catch(e => { console.error('ERR', e); process.exit(1); });
