// ==================== ROLES & AUTH ====================
export type UserRole = 'ADMIN' | 'COMPTABLE' | 'COLLABORATEUR' | 'CLIENT';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  address?: string;
  createdAt: string;
  isVerified: boolean;
  twoFactorEnabled: boolean;
}

export interface Comptable extends User {
  role: 'COMPTABLE';
  cabinetName: string;
  sector: string;
  collaboratorCount: number;
  experienceYears: number;
  description: string;
  specialties: string[];
  rating: number;
  reviewCount: number;
  patente?: string;
  rne?: string;
  coverImage?: string;
  profileStrength: number;
}

export interface Client extends User {
  role: 'CLIENT';
  companyName?: string;
  companyType?: 'entreprise' | 'particulier';
  sector?: string;
  assignedComptable?: string;
}

export interface Collaborateur extends User {
  role: 'COLLABORATEUR';
  position: string;
  assignedComptable: string;
  tasksCompleted: number;
}

// ==================== DOCUMENTS ====================
export interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
  status: 'pending' | 'reviewed' | 'archived';
  annotations?: Annotation[];
  folderId?: string;
}

export interface Annotation {
  id: string;
  content: string;
  author: string;
  createdAt: string;
}

export interface Folder {
  id: string;
  name: string;
  parentId?: string;
  documentCount: number;
}

// ==================== TASKS ====================
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedTo?: string;
  assignedToName?: string;
  createdBy: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

// ==================== MESSAGING ====================
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  timestamp: string;
  read: boolean;
  attachments?: MessageAttachment[];
}

export interface MessageAttachment {
  id: string;
  name: string;
  type: string;
  url: string;
}

export interface Conversation {
  id: string;
  participants: ConversationParticipant[];
  lastMessage?: Message;
  unreadCount: number;
  updatedAt: string;
}

export interface ConversationParticipant {
  userId: string;
  name: string;
  avatar?: string;
  role: UserRole;
  online: boolean;
}

// ==================== DEMANDES & MEETINGS ====================
export type DemandeStatus = 'pending' | 'accepted' | 'rejected' | 'completed';
export type MeetingType = 'visio' | 'phone' | 'in_person';

export interface Demande {
  id: string;
  clientId: string;
  clientName: string;
  comptableId: string;
  subject: string;
  description: string;
  status: DemandeStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Meeting {
  id: string;
  title: string;
  type: MeetingType;
  date: string;
  duration: number;
  clientId: string;
  clientName: string;
  comptableId: string;
  status: 'proposed' | 'confirmed' | 'cancelled' | 'completed';
  notes?: string;
}

// ==================== REVIEWS ====================
export interface Review {
  id: string;
  comptableId: string;
  clientId: string;
  clientName: string;
  clientAvatar?: string;
  rating: number;
  comment: string;
  createdAt: string;
}

// ==================== NOTIFICATIONS ====================
export interface Notification {
  id: string;
  type: 'message' | 'task' | 'document' | 'demande' | 'meeting' | 'system';
  title: string;
  description: string;
  read: boolean;
  createdAt: string;
  link?: string;
}

// ==================== DASHBOARD STATS ====================
export interface DashboardStats {
  totalClients: number;
  totalCollaborateurs: number;
  totalDocuments: number;
  pendingTasks: number;
  completedTasks: number;
  pendingDemandes: number;
  unreadMessages: number;
  monthlyRevenue?: number;
  revenueChange?: number;
  clientsChange?: number;
}

export interface ChartData {
  name: string;
  value: number;
  [key: string]: string | number;
}
