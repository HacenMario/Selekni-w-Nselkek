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

export interface Settings {
  subscription: {
    isEnabled: boolean;
    priceDA: number;
    durationDays: number;
    maxActiveOffers: number;
    paymentInstructions: string;
  };
  // v4.14 — commission model (replaces subscriptions): % of each DONE task charged to the executor
  commissionPercent?: number;
  packages?: unknown[];
  categories: { key: string; label: { ar: string; fr: string; en: string; tr?: string; es?: string; it?: string; de?: string; ru?: string; zh?: string }; icon: string }[];
  // v4.6 — "contact us" page, edited from the admin account
  contact?: { phone: string; email: string; instagram: string; address: string };
}

/* ---- v4.14 — commission dues (replaces the Subscription types) ---- */

/** One month of a user's executed tasks: earnings, platform commission, settlement state. */
export interface DuesMonth {
  month: string; // 'YYYY-MM'
  tasksCount: number;
  earnedDA: number;
  commissionDA: number;
  paidDA: number;
  unpaidDA: number;
  paidAt: string | null;
  note?: string;
}

export interface DuesTotals {
  tasks: number;
  earnedDA: number;
  // /dues/mine calls it commissionDA, the admin summary calls it duesDA — same figure
  commissionDA?: number;
  duesDA?: number;
  paidDA: number;
  unpaidDA: number;
}

export interface MyDues {
  rate: number;
  months: DuesMonth[];
  totals: DuesTotals;
  contact: { phone: string; email: string };
}

/** One executor row in the admin dues tab (aggregated over the selected month or all). */
export interface AdminDuesRow {
  user: { _id: string; name: string; phone: string; email: string; role?: Role };
  tasksCount: number;
  earnedDA: number;
  duesDA: number;
  paidDA: number;
  unpaidDA: number;
}

export interface AdminDuesSummary {
  rate: number;
  month: string;
  months: { month: string; tasks: number }[];
  items: AdminDuesRow[];
  totals: DuesTotals;
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
    // v4.14 — commission model
    | 'dues_reminder'
    | 'dues_paid'
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
    month?: string;
    tasksCount?: number;
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
  // v4.14 — commission dues replace the subscriptions block
  dues: { rate?: number; unpaidUsers: number; unpaidDA: number; duesDA: number; monthCommissionsDA: number };
  complaintsOpen: number;
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
  // v4.14 — commission dues replace the subscription charts
  dues: { unpaidUsers: number; unpaidDA: number; duesDA: number; monthCommissionsDA: number };
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
