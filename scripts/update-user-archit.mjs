import { MongoClient } from 'mongodb';

async function update() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('optimus');

  // Update in users collection
  const userResult = await db.collection('users').updateOne(
    { $or: [{ id: 'u_user_001' }, { email: 'user@optimus.com' }] },
    {
      $set: {
        email: 'aerospacebombay1@gmail.com',
        name: 'Archit Singh',
        full_name: 'Archit Singh',
      }
    }
  );
  console.log('Updated users:', userResult.modifiedCount);

  // Update in profiles collection
  const profileResult = await db.collection('profiles').updateOne(
    { $or: [{ id: 'u_user_001' }, { uuid: 'u_user_001' }, { email: 'user@optimus.com' }] },
    {
      $set: {
        email: 'aerospacebombay1@gmail.com',
        name: 'Archit Singh',
        full_name: 'Archit Singh',
      }
    }
  );
  console.log('Updated profiles:', profileResult.modifiedCount);

  // Verify
  const user = await db.collection('users').findOne({ id: 'u_user_001' });
  const profile = await db.collection('profiles').findOne({ id: 'u_user_001' });

  console.log('VERIFIED USER:', user);
  console.log('VERIFIED PROFILE:', profile);

  await client.close();
}

update().catch(console.error);
