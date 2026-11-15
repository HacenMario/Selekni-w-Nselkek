export type Role = 'owner' | 'seeker';
export type Lang = 'ar' | 'fr' | 'en';
export type Gender = 'male' | 'female' | '';
export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
export type IdVerified = 'none' | 'pending' | 'verified' | 'rejected';
export const BLOOD_TYPES: BloodType[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export interface User {
  _id: string;
  name: string;
  email: string;
  phone: string;
  wilaya: string;
  gender: Gender;
  age: number;
  hasAvatar?: boolean;
  role: Role;
  interests: string[];
  skills: string;
  languages: Lang[];
  // v4.9 — preferred interface accent (saved per account, applied on every device)
  uiTheme?: string;
  authProvider?: 'password' | 'google';
  profileComplete?: boolean;
  isSuperAdmin: boolean;
  isBanned: boolean;
  subLocked?: boolean;
  tasksDone?: number;
  tasksCompleted?: number;
  bloodType?: BloodType | '';
  // ID-card verification (seekers): the image itself is wiped after review
  idVerified?: IdVerified;
  hasIdCard?: boolean;
  idRejectReason?: string;
  createdAt: string;
  // bumps on every profile save — used to bust the avatar image cache
  updatedAt?: string;
}

export interface PublicUser {
  _id: string;
  name: string;
  phone?: string;
  wilaya?: string;
  gender?: Gender;
  age?: number;
  hasAvatar?: boolean;
  updatedAt?: string;
  tasksDone?: number;
  tasksCompleted?: number;
  bloodType?: BloodType | '';
  idVerified?: IdVerified;
}

export interface OfferImageMeta {
  _id: string;
  mime: string;
  size: number;
}

export interface OfferVideoMeta {
  _id: string;
  gridId: string;
  mime: string;
  size: number;
}

export interface Offer {
  _id: string;
  owner: PublicUser | string;
  title: string;
  description: string;
  categoryKey: string;
  wilaya: string;
  address?: string;
  amountDA: number;
  scheduledAt?: string | null;
  images: OfferImageMeta[];
  videos: OfferVideoMeta[];
  status: 'open' | 'assigned' | 'awaiting_confirmation' | 'done' | 'cancelled';
  acceptedBy?: PublicUser | string | null;
  acceptedAt?: string;
  completedAt?: string;
  cancelReason?: string;
  ownerPhone?: string;
  viewerIsOwner?: boolean;
  viewerIsWorker?: boolean;
  createdAt: string;
}

export interface SubPackage {
  key: string;
  name: { ar: string; fr: string; en: string; tr?: string; es?: string; it?: string; de?: string; ru?: string; zh?: string };
  priceDA: number;
  durationDays: number;
  maxActiveOffers: number;
  active: boolean;
  imageGridId?: string;
}

export interface Settings {
  subscription: {
    isEnabled: boolean;
    priceDA: number;
    durationDays: number;
    maxActiveOffers: number;
    paymentInstructions: string;
  };
  packages?: SubPackage[];
  categories: { key: string; label: { ar: string; fr: string; en: string; tr?: string; es?: string; it?: string; de?: string; ru?: string; zh?: string }; icon: string }[];
  // v4.6 — "contact us" page, edited from the admin account
  contact?: { phone: string; email: string; instagram: string; address: string };
}

export interface Subscription {
  _id: string;
  user: string | { _id: string; name: string; email: string; phone: string; role?: Role; subLocked?: boolean; isSuperAdmin?: boolean };
  status: 'pending' | 'active' | 'rejected' | 'expired';
  packageKey?: string;
  packageName?: { ar: string; fr: string; en: string };
  amountDA: number;
  durationDays?: number;
  maxActiveOffers?: number;
  reference: string;
  proofImage?: { _id: string; mime: string; size: number };
  startsAt?: string;
  endsAt?: string;
  decidedAt?: string;
  createdAt: string;
}

export interface ExpiringSub {
  _id: string;
  user: { _id: string; name: string; email?: string; phone?: string; role?: Role } | string;
  endsAt: string;
  packageKey?: string;
  amountDA: number;
  daysLeft: number;
}

export interface Complaint {
  _id: string;
  offer?: { _id: string; title: string; status: string } | string | null;
  kind?: 'complaint' | 'suggestion' | 'report';
  by: { _id: string; name: string; email?: string; phone?: string; role?: Role } | string;
  byRole?: Role;
  against?: { _id: string; name: string; email?: string; phone?: string; role?: Role } | string | null;
  subject: string;
  description: string;
  status: 'open' | 'resolved';
  resolution?: string;
  phone?: string;
  createdAt: string;
}

export interface AppNotification {
  _id: string;
  type:
    | 'new_offer_match'
    | 'offer_accepted'
    | 'offer_awaiting'
    | 'offer_done'
    | 'offer_cancelled'
    | 'subscription_pending'
    | 'subscription_confirmed'
    | 'subscription_rejected'
    | 'id_pending'
    | 'complaint_new'
    | 'complaint_resolved'
    | 'broadcast'
    | 'system';
  data: {
    offerId?: string;
    offerTitle?: string;
    amountDA?: number;
    actorName?: string;
    title?: string;
    body?: string;
    reference?: string;
    subject?: string;
    resolution?: string;
    complaintId?: string;
    [k: string]: unknown;
  };
  readAt?: string | null;
  createdAt: string;
}

export interface Stats {
  owner: { posted: number; open: number; assigned: number; awaiting: number; done: number; cancelled: number; totalSpentDA: number };
  seeker: { accepted: number; active: number; done: number; earnedDA: number };
}

export interface AdminDashboard {
  users: { total: number; owners: number; seekers: number; idPending?: number; verified?: number; banned?: number };
  offers: { open: number; assigned: number; awaiting: number; done: number; cancelled: number };
  subscriptions: { pending: number; active: number };
  complaintsOpen: number;
  expiringSubs: ExpiringSub[];
  recentUsers: User[];
}

export interface AdminStats {
  usersSeries: { date: string; count: number }[];
  offersSeries: { date: string; count: number }[];
  offersAmountSeries: { date: string; amount: number }[];
  revenueSeries: { date: string; amount: number; count: number }[];
  revenueTotalDA: number;
  byCategory: { key: string; count: number }[];
  byWilaya: { wilaya: string; count: number }[];
  subsByStatus: Record<string, number>;
  subsByPackage: { key: string; count: number; DA: number }[];
  smart: {
    avgOfferDA: number;
    totalBudgetDA: number;
    completionRate: number;
    cancelRate: number;
    totalOffers: number;
    usersTotal: number;
    // v4.5 — system-control metrics
    usersByRole: Record<string, number>;
    idStatus: Record<string, number>;
    offersByStatus: Record<string, number>;
    usersBanned: number;
    subsActive: number;
    complaints: Record<string, number>;
    tasksDone: number;
  };
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
  unreadCount?: number;
}
