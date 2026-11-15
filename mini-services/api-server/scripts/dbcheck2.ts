import mongoose from 'mongoose';
await mongoose.connect('mongodb://127.0.0.1:27017/slekni');
const db = mongoose.connection.db;
const subs = await db.collection('subscriptions').find({}).toArray();
for (const s of subs) {
  const u = await db.collection('users').findOne({ _id: s.user });
  console.log('sub:', u?.email, '| status:', s.status, '| ref:', s.reference, '| amount:', s.amountDA);
}
await mongoose.disconnect();
