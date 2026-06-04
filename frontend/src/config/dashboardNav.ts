import type { LucideIcon } from 'lucide-react';
import {
  Archive,
  Calendar,
  ClipboardList,
  CreditCard,
  FolderOpen,
  LayoutDashboard,
  ListTodo,
  MessageCircle,
  Users,
} from 'lucide-react';
import type { UserRole } from '../store/authStore';

export type NavItemConfig = {
  key: string;
  label: string;
  icon: LucideIcon;
  path?: string;
  badge?: number;
  badgeOrange?: boolean;
  children?: { label: string; path: string }[];
};

export function getDashboardNav(role: UserRole | null): NavItemConfig[] {
  const r = role ?? 'CLIENT';

  if (r === 'CLIENT') {
    return [
      { key: 'dash', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
      { key: 'espace', label: 'Mon espace', icon: FolderOpen, path: '/mon-espace' },
      { key: 'archives', label: 'Archives', icon: Archive, path: '/archives' },
      { key: 'demandes', label: 'Mes demandes', icon: ClipboardList, path: '/demandes' },
      { key: 'rdv', label: 'Mes Rendez-vous', icon: Calendar, path: '/meetings' },
      // { key: 'banques', label: 'Mes banques', icon: CreditCard, path: '/banques' },
      { key: 'msg', label: 'Messagerie', icon: MessageCircle, path: '/messaging' },
      { key: 'networking', label: 'Réseautage', icon: Users, path: '/networking' },
    ];
  }

  if (r === 'COLLABORATEUR') {
    return [
      { key: 'dash', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
      { key: 'tasks', label: 'Task management', icon: ListTodo, path: '/tasks' },
      { key: 'msg', label: 'Messagerie', icon: MessageCircle, path: '/messaging' },
    ];
  }

  if (r === 'ADMIN') {
    return [
      { key: 'dash', label: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
      // { key: 'accountants', label: 'Comptables', icon: UserPlus, path: '/admin/accountants' },
      { key: 'users', label: 'Utilisateurs', icon: Users, path: '/admin/users' },
      // { key: 'reviews', label: 'Avis', icon: ShieldCheck, path: '/admin/reviews' },
      // { key: 'storage', label: 'Stockage', icon: HardDrive, path: '/admin/storage' },
      // { key: 'analytics', label: 'Analytics', icon: LineChart, path: '/admin/analytics' },
      // { key: 'audit', label: 'Audit logs', icon: ClipboardList, path: '/admin/audit-logs' },
      { key: 'profile', label: 'Profil', icon: FolderOpen, path: '/admin/profile' },
    ];
  }

  return [
    { key: 'dash', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { key: 'clients', label: 'Mes clients', icon: Users, path: '/clients' },
    { key: 'demandes', label: 'Demandes des clients', icon: ClipboardList, path: '/demandes-clients' },

    // {
    //   key: 'demandes',
    //   label: 'Demandes des clients',
    //   icon: ClipboardList,
    //   // children: [
    //   //   // { label: 'Mes demandes', path: '/mes-demandes' },
    //   //   { label: 'Demandes des clients', path: '/demandes-clients' },
    //   // ],
    // },
    {
      key: 'collabs',
      label: 'G. des collaborateurs',
      icon: ListTodo,
      children: [
        { label: 'Mes collaborateurs', path: '/collaborators' },
        { label: 'Task management', path: '/tasks' },
      ],
    },
    { key: 'rdv', label: 'Mes Rendez-vous', icon: Calendar, path: '/meetings' },
    { key: 'msg', label: 'Messagerie', icon: MessageCircle, path: '/messaging' },
    // { key: 'networking', label: 'Networking', icon: Users, path: '/networking' },
  ];
}
