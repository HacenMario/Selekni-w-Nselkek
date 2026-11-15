import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: new URL('../.env', import.meta.url).pathname });
await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/slekni');
const r = await mongoose.connection.db.collection('users').deleteMany({});
console.log('deleted users:', r.deletedCount);
await mongoose.disconnect();
