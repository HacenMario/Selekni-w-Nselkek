import mongoose from 'mongoose';
import { env } from './env';

export async function connectDb(): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri, { autoIndex: true });
  console.log(`[db] MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
}
