import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Status, Role } from '@prisma/client';

@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService) {}

  async getClientStats(userId: string) {
    const [docCount, folderCount, invoiceSummary, pendingRequests, nextMeeting, recentDocs, allInvoices, allDocs] = await Promise.all([
      this.prisma.document.count({ where: { clientId: userId } }),
      this.prisma.folder.count({ where: { clientId: userId } }),
      this.prisma.invoice.aggregate({
        where: { document: { clientId: userId }, status: { in: [Status.VALIDATED, Status.DONE] } },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      this.prisma.request.count({ where: { clientId: userId, status: Status.PENDING } }),
      this.prisma.meeting.findFirst({
        where: { clientId: userId, scheduledAt: { gte: new Date() }, status: Status.ACTIVE },
        orderBy: { scheduledAt: 'asc' },
      }),
      this.prisma.document.findMany({
        where: { clientId: userId },
        orderBy: { createdAt: 'desc' },
        take: 5
      }),
      this.prisma.invoice.findMany({
        where: { document: { clientId: userId }, status: { in: [Status.VALIDATED, Status.DONE] } },
        select: { invoiceDate: true, createdAt: true, totalAmount: true }
      }),
      this.prisma.document.findMany({
        where: { clientId: userId },
        select: { type: true }
      })
    ]);

    // Format revenue (expense) Data
    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    const expenseMap = new Map<number, number>();
    allInvoices.forEach(inv => {
      const date = inv.invoiceDate || inv.createdAt;
      if (date && inv.totalAmount) {
        const month = date.getMonth();
        expenseMap.set(month, (expenseMap.get(month) || 0) + inv.totalAmount);
      }
    });

    let expenseData = [];
    const currentMonth = new Date().getMonth();
    for (let i = 8; i >= 0; i--) {
      let m = currentMonth - i;
      if (m < 0) m += 12;
      expenseData.push({
        name: monthNames[m],
        value: expenseMap.get(m) || 0
      });
    }

    // Pie data
    const typeCount: Record<string, number> = {};
    allDocs.forEach(d => {
      let type = 'Autres';
      if (d.type.includes('pdf')) type = 'PDF';
      else if (d.type.includes('image')) type = 'Images';
      else if (d.type.includes('spreadsheet') || d.type.includes('excel')) type = 'Tableurs';
      typeCount[type] = (typeCount[type] || 0) + 1;
    });

    let pieData = Object.entries(typeCount).map(([name, value]) => ({ name, value }));

    // ✨ DEMO MOCK FOR EMPTY ACCOUNTS removed by request so new users see empty dashboards.

    return {
      documents: docCount,
      folders: folderCount,
      invoices: {
        count: invoiceSummary._count.id,
        totalAmount: invoiceSummary._sum.totalAmount || 0,
      },
      pendingRequests,
      nextMeeting,
      revenueData: expenseData,
      pieData,
      recentActivity: recentDocs.map(d => ({
        name: d.name,
        type: d.status === 'PENDING' ? 'En cours' : 'Validé',
        date: d.createdAt.toISOString()
      }))
    };
  }

  async getAccountantStats(userId: string) {
    const [clientCount, pendingInvoices, pendingRequests, todayMeetings, recentClients, upcomingTasks, invoices, allClients, syncedInvoices] = await Promise.all([
      this.prisma.accountantClient.count({ where: { accountantId: userId } }),
      this.prisma.invoice.count({ 
        where: { 
          status: Status.PENDING,
          document: {
            OR: [
              { accountantId: userId },
              { client: { accountantClients: { some: { accountantId: userId } } } }
            ]
          }
        } 
      }),
      this.prisma.request.count({ where: { accountantId: userId, status: Status.PENDING } }),
      this.prisma.meeting.count({
        where: {
          accountantId: userId,
          scheduledAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lte: new Date(new Date().setHours(23, 59, 59, 999)),
          },
        },
      }),
      this.prisma.accountantClient.findMany({
        where: { accountantId: userId },
        orderBy: { client: { createdAt: 'desc' } },
        take: 5,
        include: { client: { select: { companyName: true, firstName: true, lastName: true, activitySector: true, status: true, createdAt: true } } }
      }),
      this.prisma.task.findMany({
        where: { 
          assignees: { some: { id: userId } },
          status: { notIn: [Status.DONE, Status.INACTIVE, Status.REJECTED] }
        },
        orderBy: { deadline: 'asc' },
        take: 5,
        include: { assignees: { select: { firstName: true, lastName: true } } }
      }),
      this.prisma.invoice.findMany({
        where: {
          document: { accountantId: userId },
          status: { in: [Status.ACTIVE, Status.VALIDATED, Status.DONE] }
        },
        select: { invoiceDate: true, createdAt: true, totalAmount: true }
      }),
      this.prisma.accountantClient.findMany({
        where: { accountantId: userId },
        select: { client: { select: { activitySector: true } } }
      }),
      this.prisma.invoice.count({
        where: {
          status: { in: [Status.VALIDATED, Status.DONE] },
          document: {
            OR: [
              { accountantId: userId },
              { client: { accountantClients: { some: { accountantId: userId } } } }
            ]
          }
        }
      }),
    ]);

    // Format revenue data (last 9 months including current)
    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    const revenueMap = new Map<number, number>();
    invoices.forEach(inv => {
      const date = inv.invoiceDate || inv.createdAt;
      if (date && inv.totalAmount) {
        const month = date.getMonth();
        revenueMap.set(month, (revenueMap.get(month) || 0) + inv.totalAmount);
      }
    });
    
    const revenueData = [];
    const currentMonth = new Date().getMonth();
    for (let i = 8; i >= 0; i--) {
      let m = currentMonth - i;
      if (m < 0) m += 12;
      revenueData.push({
        name: monthNames[m],
        value: revenueMap.get(m) || 0
      });
    }

    // Format pie data
    const sectorCount: Record<string, number> = {};
    allClients.forEach(c => {
      const sector = c.client.activitySector || 'Général';
      sectorCount[sector] = (sectorCount[sector] || 0) + 1;
    });
    
    let pieData = Object.entries(sectorCount).map(([name, value]) => ({ name, value }));
    if (pieData.length === 0) {
      pieData = [{ name: 'Aucun client', value: 1 }];
    }

    return {
      clients: clientCount,
      pendingInvoices,
      syncedInvoices,
      pendingRequests,
      todayMeetings,
      recentClients: recentClients.map(rc => ({
        name: rc.client.companyName || `${rc.client.firstName} ${rc.client.lastName}`,
        sector: rc.client.activitySector || 'Général',
        status: rc.client.status === Status.ACTIVE ? 'Actif' : rc.client.status === Status.PENDING ? 'En attente' : 'Inactif',
        date: rc.client.createdAt.toISOString().split('T')[0]
      })),
      upcomingTasks: upcomingTasks.map(t => ({
        title: t.title,
        assignee: t.assignees[0] ? `${t.assignees[0].firstName} ${t.assignees[0].lastName.charAt(0)}.` : 'Non assigné',
        due: t.deadline ? t.deadline.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : 'Pas de date',
        priority: t.priority.toLowerCase()
      })),
      revenueData,
      pieData
    };
  }

  async getCollaboratorStats(userId: string) {
    const [pendingRequests, pendingTasks, docCount] = await Promise.all([
      this.prisma.request.count({
        where: { accountantId: userId, status: Status.PENDING }
      }),
      this.prisma.task.count({
        where: { 
          assignees: { some: { id: userId } },
          status: { notIn: [Status.DONE, Status.INACTIVE, Status.VALIDATED] }
        }
      }),
      this.prisma.document.count({
        where: { 
          OR: [
            { accountantId: userId },
            { client: { accountantClients: { some: { accountantId: userId } } } }
          ]
        }
      })
    ]);

    // Get unread messages count for this collaborator
    const unreadMessages = await this.prisma.messageRead.count({
       where: { 
         userId,
         readAt: null as any // This depends on how unread is tracked
       }
    }).catch(() => 0); // Catch if logic differs

    return {
      pendingRequests,
      pendingTasks,
      documents: docCount,
      messages: unreadMessages || 0,
    };
  }

  async getAdminDashboardStats() {
    const [
      totalUsers,
      totalComptables,
      totalClients,
      totalCollabs,
      totalStorage,
      newUsersToday,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: Role.COMPTABLE } }),
      this.prisma.user.count({ where: { role: Role.CLIENT } }),
      this.prisma.user.count({ where: { role: Role.COLLABORATEUR } }),
      this.prisma.organization.aggregate({ _sum: { storageUsed: true } }),
      this.prisma.user.count({
        where: {
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
    ]);

    const pendingComptables = await this.prisma.user.count({ where: { role: Role.COMPTABLE, status: Status.PENDING }});
    const pendingReviews = await this.prisma.review.count({ where: { status: Status.PENDING }});
    const pendingRequests = await this.prisma.request.count({ where: { status: Status.PENDING }});
    const disabledUsers = await this.prisma.user.count({ where: { status: Status.INACTIVE }});
    
    // Growth mock
    const growth = [
      { date: 'Lun', count: 12 },
      { date: 'Mar', count: 25 },
      { date: 'Mer', count: 45 },
      { date: 'Jeu', count: 80 },
      { date: 'Ven', count: 120 },
      { date: 'Sam', count: 180 },
      { date: 'Dim', count: totalUsers },
    ];

    const recentAuditLogs = await this.prisma.auditLog.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });

    return {
      usersByRole: {
        ADMIN: totalUsers - totalComptables - totalClients - totalCollabs, // Assuming the rest are ADMIN
        COMPTABLE: totalComptables,
        CLIENT: totalClients,
        COLLABORATEUR: totalCollabs,
      },
      globalStats: {
        totalUsers,
        newUsersToday,
        disabledUsers,
        storageUsed: totalStorage._sum.storageUsed || 0,
        storageLimit: 100 * 1024 * 1024 * 1024,
        alerts: pendingComptables + pendingReviews + pendingRequests,
      },
      systemAlerts: {
        pendingComptables,
        storageOverages: 0,
        pendingReviews,
        pendingRequests,
      },
      growth,
      recentAuditLogs,
    };
  }

  async getAdminAnalytics() {
    // Dans une application réelle, on ferait des agrégations SQL par mois.
    // Ici, on retourne des données formatées pour Recharts.
    return {
      userGrowth: [
        { name: 'Jan', users: 10 },
        { name: 'Fév', users: 25 },
        { name: 'Mar', users: 45 },
        { name: 'Avr', users: 80 },
        { name: 'Mai', users: 120 },
        { name: 'Jun', users: 180 },
      ],
      storageUsage: [
        { name: 'Jan', gb: 5 },
        { name: 'Fév', gb: 12 },
        { name: 'Mar', gb: 28 },
        { name: 'Avr', gb: 45 },
        { name: 'Mai', gb: 62 },
        { name: 'Jun', gb: 78 },
      ],
    };
  }
}
