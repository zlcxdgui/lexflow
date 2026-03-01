import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const userSafeSelect = {
  id: true,
  name: true,
  email: true,
} satisfies Prisma.UserSelect;

const notificationSelect = {
  id: true,
  kind: true,
  title: true,
  subtitle: true,
  href: true,
  isRead: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

type NotificationRow = Prisma.NotificationGetPayload<{
  select: typeof notificationSelect;
}>;

function startOfDay(d: Date) {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0),
  );
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getDashboard(
    tenantId: string,
    days: number,
    filters?: {
      viewerUserId?: string;
      hideData?: boolean;
    },
  ) {
    const n = Number.isFinite(days) && days > 0 ? Math.min(days, 60) : 14;
    const viewerUserId = (filters?.viewerUserId || '').trim();
    const hideData = Boolean(filters?.hideData);

    const from = startOfDay(new Date());
    const to = new Date(from.getTime() + n * 24 * 60 * 60 * 1000);

    const openMattersCount = await this.prisma.matter.count({
      where: { tenantId, status: 'OPEN' },
    });

    const taskWhere: Prisma.TaskWhereInput = {
      tenantId,
      status: { in: ['OPEN', 'DOING'] },
      ...(viewerUserId ? { assignedToUserId: viewerUserId } : {}),
    };

    const deadlineWhere: Prisma.DeadlineWhereInput = {
      tenantId,
      isDone: false,
      ...(viewerUserId
        ? {
            OR: [
              { matter: { members: { some: { userId: viewerUserId } } } },
              {
                matter: { tasks: { some: { assignedToUserId: viewerUserId } } },
              },
            ],
          }
        : {}),
    };

    const upcomingDeadlineWhere: Prisma.DeadlineWhereInput = {
      ...deadlineWhere,
      dueDate: { gte: from, lt: to },
    };

    let upcomingDeadlines: Prisma.DeadlineGetPayload<{
      include: { matter: true };
    }>[] = [];
    let openTasks: Prisma.TaskGetPayload<{
      include: {
        matter: true;
        assignedTo: { select: typeof userSafeSelect };
        createdBy: { select: typeof userSafeSelect };
      };
    }>[] = [];
    let openTasksCount = 0;
    let pendingDeadlinesCount = 0;

    if (!hideData) {
      [upcomingDeadlines, openTasks, openTasksCount, pendingDeadlinesCount] =
        await this.prisma.$transaction([
          this.prisma.deadline.findMany({
            where: upcomingDeadlineWhere,
            orderBy: { dueDate: 'asc' },
            include: { matter: true },
            take: 50,
          }),
          this.prisma.task.findMany({
            where: taskWhere,
            orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
            include: {
              matter: true,
              assignedTo: { select: userSafeSelect },
              createdBy: { select: userSafeSelect },
            },
            take: 50,
          }),
          this.prisma.task.count({ where: taskWhere }),
          this.prisma.deadline.count({ where: deadlineWhere }),
        ]);
    }

    return {
      rangeDays: n,
      counts: {
        openMatters: openMattersCount,
        openTasks: openTasksCount,
        pendingDeadlines: pendingDeadlinesCount,
      },
      upcomingDeadlines,
      openTasks,
    };
  }

  async getNotifications(tenantId: string, userId: string) {
    const [items, unreadTotal] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where: { tenantId, recipientUserId: userId },
        orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
        take: 100,
        select: notificationSelect,
      }),
      this.prisma.notification.count({
        where: { tenantId, recipientUserId: userId, isRead: false },
      }),
    ]);

    const counters = {
      overdueDeadlines: items.filter(
        (n: NotificationRow) => !n.isRead && n.kind === 'DEADLINE_OVERDUE',
      ).length,
      todayDeadlines: items.filter(
        (n: NotificationRow) => !n.isRead && n.kind === 'DEADLINE_TODAY',
      ).length,
      highPriorityTasks: items.filter(
        (n: NotificationRow) =>
          !n.isRead && (n.kind === 'TASK_HIGH' || n.kind === 'TASK_ASSIGNED'),
      ).length,
      pendingInvites: items.filter(
        (n: NotificationRow) => !n.isRead && n.kind === 'INVITE_PENDING',
      ).length,
    };

    return {
      total: items.length,
      unreadTotal,
      counters,
      items: items.map((n: NotificationRow) => ({
        id: n.id,
        itemKey: n.id,
        kind: n.kind,
        title: n.title,
        subtitle: n.subtitle || '',
        href: n.href,
        when: n.createdAt.toISOString(),
        isRead: n.isRead,
      })),
    };
  }

  async markNotificationRead(
    tenantId: string,
    userId: string,
    notificationId: string,
  ) {
    const id = String(notificationId || '').trim();
    if (!id) return { ok: false };
    const result = await this.prisma.notification.updateMany({
      where: { id, tenantId, recipientUserId: userId },
      data: { isRead: true, readAt: new Date() },
    });
    if ((result?.count || 0) > 0) {
      await this.audit.log(
        tenantId,
        'NOTIFICATION_MARKED_READ',
        userId,
        undefined,
        {
          notificationId: id,
        },
      );
    }
    return { ok: true };
  }

  async markAllNotificationsRead(tenantId: string, userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { tenantId, recipientUserId: userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    if ((result?.count || 0) > 0) {
      await this.audit.log(
        tenantId,
        'NOTIFICATION_MARKED_ALL_READ',
        userId,
        undefined,
        { count: result?.count || 0 },
      );
    }
    return { ok: true, count: result?.count || 0 };
  }
}
