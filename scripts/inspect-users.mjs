import { MongoClient } from 'mongodb';

async function check() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('optimus');

  const users = await db.collection('users').find().toArray();
  console.log('=== USERS ===');
  console.log(JSON.stringify(users, null, 2));

  const profiles = await db.collection('profiles').find().toArray();
  console.log('=== PROFILES ===');
  console.log(JSON.stringify(profiles, null, 2));

  await client.close();
}

check().catch(console.error);
