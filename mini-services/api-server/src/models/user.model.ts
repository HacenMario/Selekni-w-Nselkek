import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  phone: string;
  wilaya: string;
  gender: 'male' | 'female' | '';
  age: number;
  avatar?: Buffer;
  avatarMime?: string;
  avatarIsSet?: boolean;
  passwordHash: string;
  role: 'owner' | 'seeker';
  interests: string[];
  skills: string;
  languages: string[];
  // v4.9 — preferred interface accent color, applied on every device at login
  uiTheme: string;
  authProvider: 'password' | 'google';
  profileComplete: boolean;
  isSuperAdmin: boolean;
  isBanned: boolean;
  subLocked?: boolean;
  tasksDone?: number;
  tasksCompleted?: number;
  // emergency medical info shown on task cards (may save a life after an injury)
  bloodType: string;
  // ID-card verification (seeker accounts): image is stored only until the
  // super admin decides, then wiped from the database for privacy
  idCard?: Buffer;
  idCardMime?: string;
  idVerified: 'none' | 'pending' | 'verified' | 'rejected';
  idRejectReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    phone: { type: String, default: '', trim: true, maxlength: 20 },
    wilaya: { type: String, default: '' },
    gender: { type: String, enum: ['male', 'female', ''], default: '' },
    age: { type: Number, min: 0, max: 120, default: 0 },
    avatar: { type: Buffer, select: 0 },
    avatarMime: { type: String, default: '' },
    avatarIsSet: { type: Boolean, default: false },
    passwordHash: { type: String, default: '' },
    role: { type: String, enum: ['owner', 'seeker'], default: 'seeker' },
    interests: { type: [String], default: [] },
    skills: { type: String, default: '' },
    languages: { type: [String], default: ['ar', 'fr', 'en'] },
    // v4.9 — preferred interface accent color, applied on every device at login
    uiTheme: { type: String, default: '' },
    authProvider: { type: String, enum: ['password', 'google'], default: 'password' },
    // false only while a Google user has not finished onboarding yet
    profileComplete: { type: Boolean, default: true },
    isSuperAdmin: { type: Boolean, default: false },
    isBanned: { type: Boolean, default: false },
    // super admin can disable/enable a user's subscription from the admin panel
    subLocked: { type: Boolean, default: false },
    // gamification counters: tasks completed as executor / as owner
    tasksDone: { type: Number, default: 0 },
    tasksCompleted: { type: Number, default: 0 },
    bloodType: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', ''], default: '' },
    // ID-card verification: 'pending' while awaiting the super admin decision;
    // the image buffer is deleted as soon as a decision (verify OR reject) is made
    idCard: { type: Buffer, select: 0 },
    idCardMime: { type: String, default: '' },
    idVerified: { type: String, enum: ['none', 'pending', 'verified', 'rejected'], default: 'none' },
    idRejectReason: { type: String, default: '' },
  },
  { timestamps: true, toJSON: { transform: (_doc, retAny) => { const ret = retAny as any; delete ret.passwordHash; delete ret.avatar; delete ret.idCard; ret.hasAvatar = Boolean(_doc.avatarIsSet); ret.hasIdCard = Boolean(_doc.idCardMime); ret.subLocked = Boolean(_doc.subLocked); ret.tasksDone = _doc.tasksDone || 0; ret.tasksCompleted = _doc.tasksCompleted || 0; ret.idVerified = _doc.idVerified || 'none'; ret.bloodType = _doc.bloodType || ''; return ret; } } }
);

export const User = model<IUser>('User', UserSchema);
