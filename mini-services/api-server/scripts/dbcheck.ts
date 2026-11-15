import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
await mongoose.connect('mongodb://127.0.0.1:27017/slekni');
const db = mongoose.connection.db;
const users = await db.collection('users').find({}).toArray();
for (const u of users) {
  console.log('user:', u.email, '| isSuperAdmin:', u.isSuperAdmin, '| role:', u.role, '| hash-prefix:', String(u.passwordHash).slice(0, 10));
  if (u.email === 'admin@slekni.dz') {
    console.log('  pwd SlekniAdmin#2026 matches:', await bcrypt.compare('SlekniAdmin#2026', u.passwordHash));
    console.log('  pwd SlekniAdmin matches:', await bcrypt.compare('SlekniAdmin', u.passwordHash));
  }
}
console.log('offers:', await db.collection('offers').countDocuments());
const o = await db.collection('offers').findOne({});
if (o) console.log('offer sample:', o._id, o.status, 'images:', (o.images||[]).length, 'owner:', o.owner);
await mongoose.disconnect();
