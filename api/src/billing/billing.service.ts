import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const ACTIVE_SUBSCRIPTION_STATUSES = ['TRIAL', 'ACTIVE', 'PAST_DUE'];

type EntitlementView = {
  maxUsers: number | null;
  maxMatters: number | null;
  storageLimitGb: number | null;
  reportsAdvanced: boolean;
  auditExport: boolean;
  customAccessGroups: boolean;
  appointmentsModule: boolean;
  prioritySupport: boolean;
};

type BillingCycle = 'MONTHLY' | 'YEARLY';

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async ensureUsageSnapshot(tenantId: string) {
    const [usersCount, activeUsersCount, mattersCount, storageAgg] =
      await Promise.all([
        this.prisma.tenantMember.count({ where: { tenantId } }),
        this.prisma.tenantMember.count({ where: { tenantId, isActive: true } }),
        this.prisma.matter.count({ where: { tenantId } }),
        this.prisma.document.aggregate({
          where: { tenantId },
          _sum: { sizeBytes: true },
        }),
      ]);

    return this.prisma.tenantSubscriptionUsage.upsert({
      where: { tenantId },
      update: {
        usersCount,
        activeUsersCount,
        mattersCount,
        storageBytes: BigInt(storageAgg._sum.sizeBytes || 0),
        lastRecalculatedAt: new Date(),
      },
      create: {
        tenantId,
        usersCount,
        activeUsersCount,
        mattersCount,
        storageBytes: BigInt(storageAgg._sum.sizeBytes || 0),
        lastRecalculatedAt: new Date(),
      },
    });
  }

  async getCurrentEntitlements(tenantId: string) {
    const [subscription, usage] = await Promise.all([
      this.prisma.tenantSubscription.findFirst({
        where: {
          tenantId,
          status: { in: ACTIVE_SUBSCRIPTION_STATUSES },
        },
        orderBy: [{ currentPeriodEnd: 'desc' }, { createdAt: 'desc' }],
        include: {
          plan: true,
        },
      }),
      this.ensureUsageSnapshot(tenantId),
    ]);

    const plan = subscription?.plan || null;
    const entitlements: EntitlementView = {
      maxUsers: plan?.maxUsers ?? null,
      maxMatters: plan?.maxMatters ?? null,
      storageLimitGb: plan?.storageLimitGb ?? null,
      reportsAdvanced: Boolean(plan?.reportsAdvanced),
      auditExport: Boolean(plan?.auditExport),
      customAccessGroups: Boolean(plan?.customAccessGroups),
      appointmentsModule: plan ? Boolean(plan.appointmentsModule) : true,
      prioritySupport: Boolean(plan?.prioritySupport),
    };

    return {
      tenantId,
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            billingCycle: subscription.billingCycle,
            trialEndsAt: subscription.trialEndsAt,
            currentPeriodStart: subscription.currentPeriodStart,
            currentPeriodEnd: subscription.currentPeriodEnd,
            graceEndsAt: subscription.graceEndsAt,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            canceledAt: subscription.canceledAt,
          }
        : null,
      plan: plan
        ? {
            id: plan.id,
            key: plan.key,
            name: plan.name,
            description: plan.description,
            isActive: plan.isActive,
          }
        : null,
      entitlements,
      usage: {
        usersCount: usage.usersCount,
        activeUsersCount: usage.activeUsersCount,
        mattersCount: usage.mattersCount,
        storageBytes: Number(usage.storageBytes || BigInt(0)),
        lastRecalculatedAt: usage.lastRecalculatedAt,
      },
      limitsReached: {
        users:
          entitlements.maxUsers != null &&
          usage.activeUsersCount >= entitlements.maxUsers,
        matters:
          entitlements.maxMatters != null &&
          usage.mattersCount >= entitlements.maxMatters,
        storage:
          entitlements.storageLimitGb != null &&
          Number(usage.storageBytes || BigInt(0)) >=
            entitlements.storageLimitGb * 1024 * 1024 * 1024,
      },
    };
  }

  async listPlansCatalog() {
    const plans = await this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });

    return plans.map((plan) => ({
      id: plan.id,
      key: plan.key,
      name: plan.name,
      description: plan.description,
      isSystem: plan.isSystem,
      entitlements: {
        maxUsers: plan.maxUsers,
        maxMatters: plan.maxMatters,
        storageLimitGb: plan.storageLimitGb,
        reportsAdvanced: plan.reportsAdvanced,
        auditExport: plan.auditExport,
        customAccessGroups: plan.customAccessGroups,
        appointmentsModule: plan.appointmentsModule,
        prioritySupport: plan.prioritySupport,
      },
    }));
  }

  private activeOrTrialStatus(status?: string | null) {
    const normalized = String(status || '').toUpperCase();
    return (
      normalized === 'ACTIVE' ||
      normalized === 'TRIAL' ||
      normalized === 'PAST_DUE'
    );
  }

  async changePlan(
    tenantId: string,
    userId: string,
    input: {
      planKey: string;
      billingCycle?: string | null;
      source?: string | null;
      userEmail?: string | null;
    },
  ) {
    const planKey = String(input.planKey || '')
      .trim()
      .toUpperCase();
    if (!planKey) throw new BadRequestException('Plano inválido.');

    const billingCycle =
      String(input.billingCycle || 'MONTHLY').toUpperCase() === 'YEARLY'
        ? 'YEARLY'
        : 'MONTHLY';

    const plan = await this.prisma.plan.findFirst({
      where: { key: planKey, isActive: true },
    });
    if (!plan) {
      throw new BadRequestException('Plano não encontrado.');
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setUTCMonth(
      periodEnd.getUTCMonth() + (billingCycle === 'YEARLY' ? 12 : 1),
    );

    const current = await this.prisma.tenantSubscription.findFirst({
      where: {
        tenantId,
        status: { in: ['TRIAL', 'ACTIVE', 'PAST_DUE'] },
      },
      orderBy: [{ currentPeriodEnd: 'desc' }, { createdAt: 'desc' }],
      include: { plan: true },
    });

    const previousPlanKey = current?.plan?.key || null;
    const previousPlanName = current?.plan?.name || null;
    const previousStatus = current?.status || null;

    let subscription;
    if (current) {
      subscription = await this.prisma.tenantSubscription.update({
        where: { id: current.id },
        data: {
          planId: plan.id,
          billingCycle,
          status: this.activeOrTrialStatus(current.status)
            ? current.status
            : 'ACTIVE',
          currentPeriodStart: current.currentPeriodStart || now,
          currentPeriodEnd: current.currentPeriodEnd || periodEnd,
          cancelAtPeriodEnd: false,
          canceledAt: null,
          externalProvider: current.externalProvider || 'manual',
        },
      });
    } else {
      subscription = await this.prisma.tenantSubscription.create({
        data: {
          tenantId,
          planId: plan.id,
          status: 'ACTIVE',
          billingCycle,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
          externalProvider: 'manual',
        },
      });
    }

    await this.audit.log(tenantId, 'BILLING_PLAN_CHANGED', userId, undefined, {
      previousPlanKey,
      previousPlanName,
      nextPlanKey: plan.key,
      nextPlanName: plan.name,
      previousStatus,
      nextStatus: subscription.status,
      billingCycle,
      source: input.source || 'manual-ui',
      userEmail: input.userEmail || undefined,
    });

    return this.getCurrentEntitlements(tenantId);
  }

  async setCancelAtPeriodEnd(
    tenantId: string,
    userId: string,
    input: { cancelAtPeriodEnd: boolean; userEmail?: string | null },
  ) {
    const current = await this.prisma.tenantSubscription.findFirst({
      where: {
        tenantId,
        status: { in: ['TRIAL', 'ACTIVE', 'PAST_DUE'] },
      },
      orderBy: [{ currentPeriodEnd: 'desc' }, { createdAt: 'desc' }],
      include: { plan: true },
    });

    if (!current) {
      throw new BadRequestException(
        'Nenhuma assinatura ativa encontrada para este escritório.',
      );
    }

    const updated = await this.prisma.tenantSubscription.update({
      where: { id: current.id },
      data: {
        cancelAtPeriodEnd: Boolean(input.cancelAtPeriodEnd),
      },
    });

    await this.audit.log(
      tenantId,
      'BILLING_CANCEL_AT_PERIOD_END_UPDATED',
      userId,
      undefined,
      {
        planKey: current.plan?.key || null,
        planName: current.plan?.name || null,
        previousCancelAtPeriodEnd: current.cancelAtPeriodEnd,
        nextCancelAtPeriodEnd: updated.cancelAtPeriodEnd,
        currentPeriodEnd: current.currentPeriodEnd,
        userEmail: input.userEmail || undefined,
      },
    );

    return this.getCurrentEntitlements(tenantId);
  }

  async recordWebhookEvent(
    tenantId: string,
    input: {
      provider: string;
      eventType: string;
      status?: string | null;
      referenceId?: string | null;
      payload?: unknown;
    },
  ) {
    const provider =
      String(input.provider || '')
        .trim()
        .toLowerCase() || 'manual';
    const eventType = String(input.eventType || '').trim() || 'unknown';
    const payloadJson =
      input.payload === undefined ? null : JSON.stringify(input.payload);

    const event = await this.prisma.billingEvent.create({
      data: {
        tenantId,
        provider,
        eventType,
        status: input.status || null,
        referenceId: input.referenceId || null,
        payloadJson,
        processedAt: new Date(),
      },
    });

    await this.audit.log(
      tenantId,
      'BILLING_WEBHOOK_RECEIVED',
      undefined,
      undefined,
      {
        provider,
        eventType,
        status: input.status || null,
        referenceId: input.referenceId || null,
        billingEventId: event.id,
      },
    );

    return { ok: true, id: event.id };
  }

  async listMyPlanChangeRequests(tenantId: string) {
    const rows = await this.prisma.billingPlanChangeRequest.findMany({
      where: { tenantId },
      orderBy: [{ createdAt: 'desc' }],
      take: 20,
      include: {
        requestedPlan: {
          select: { id: true, key: true, name: true },
        },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      status: row.status,
      requestedBillingCycle: row.requestedBillingCycle,
      notes: row.notes,
      requestedByUserId: row.requestedByUserId,
      requestedByEmail: row.requestedByEmail,
      reviewedByUserId: row.reviewedByUserId,
      reviewedByEmail: row.reviewedByEmail,
      reviewedAt: row.reviewedAt,
      resolutionNotes: row.resolutionNotes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      requestedPlan: row.requestedPlan,
    }));
  }

  async requestPlanChange(
    tenantId: string,
    userId: string,
    input: {
      planKey: string;
      billingCycle?: string | null;
      notes?: string | null;
      userEmail?: string | null;
    },
  ) {
    const planKey = String(input.planKey || '')
      .trim()
      .toUpperCase();
    if (!planKey) throw new BadRequestException('Plano é obrigatório.');

    const billingCycle: BillingCycle =
      String(input.billingCycle || 'MONTHLY').toUpperCase() === 'YEARLY'
        ? 'YEARLY'
        : 'MONTHLY';

    const [plan, current] = await Promise.all([
      this.prisma.plan.findFirst({ where: { key: planKey, isActive: true } }),
      this.prisma.tenantSubscription.findFirst({
        where: { tenantId, status: { in: ['TRIAL', 'ACTIVE', 'PAST_DUE'] } },
        orderBy: [{ currentPeriodEnd: 'desc' }, { createdAt: 'desc' }],
        include: { plan: true },
      }),
    ]);

    if (!plan) throw new BadRequestException('Plano não encontrado.');

    if (current?.plan?.key === plan.key) {
      throw new BadRequestException('O escritório já está nesse plano.');
    }

    const pendingRequest = await this.prisma.billingPlanChangeRequest.findFirst(
      {
        where: {
          tenantId,
          status: 'PENDING',
        },
        orderBy: { createdAt: 'desc' },
        include: {
          requestedPlan: { select: { id: true, key: true, name: true } },
        },
      },
    );

    const row = pendingRequest
      ? await this.prisma.billingPlanChangeRequest.update({
          where: { id: pendingRequest.id },
          data: {
            requestedPlanId: plan.id,
            requestedBillingCycle: billingCycle,
            notes: input.notes?.trim() || null,
            requestedByUserId: userId,
            requestedByEmail: input.userEmail || null,
          },
          include: {
            requestedPlan: { select: { id: true, key: true, name: true } },
          },
        })
      : await this.prisma.billingPlanChangeRequest.create({
          data: {
            tenantId,
            requestedPlanId: plan.id,
            requestedBillingCycle: billingCycle,
            status: 'PENDING',
            notes: input.notes?.trim() || null,
            requestedByUserId: userId,
            requestedByEmail: input.userEmail || null,
          },
          include: {
            requestedPlan: { select: { id: true, key: true, name: true } },
          },
        });

    await this.audit.log(
      tenantId,
      'BILLING_PLAN_CHANGE_REQUESTED',
      userId,
      undefined,
      {
        requestId: row.id,
        previousRequestedPlanKey: pendingRequest?.requestedPlan?.key || null,
        previousRequestedPlanName: pendingRequest?.requestedPlan?.name || null,
        currentPlanKey: current?.plan?.key || null,
        currentPlanName: current?.plan?.name || null,
        requestedPlanKey: row.requestedPlan.key,
        requestedPlanName: row.requestedPlan.name,
        requestedBillingCycle: billingCycle,
        notes: row.notes || null,
        replacedPendingRequest: Boolean(pendingRequest),
        userEmail: input.userEmail || null,
      },
    );

    return {
      id: row.id,
      status: row.status,
      requestedBillingCycle: row.requestedBillingCycle,
      notes: row.notes,
      createdAt: row.createdAt,
      requestedPlan: row.requestedPlan,
    };
  }

  async listTenantPlanChangeRequestsAdmin(tenantId: string) {
    return this.listMyPlanChangeRequests(tenantId);
  }

  async reviewPlanChangeRequest(
    requestId: string,
    reviewer: { userId: string; email?: string | null },
    input: { status: 'APPROVED' | 'REJECTED'; resolutionNotes?: string | null },
  ) {
    const request = await this.prisma.billingPlanChangeRequest.findUnique({
      where: { id: requestId },
      include: {
        requestedPlan: true,
        tenant: { select: { id: true, name: true } },
      },
    });
    if (!request) throw new BadRequestException('Solicitação não encontrada.');
    if (request.status !== 'PENDING') {
      throw new BadRequestException('A solicitação já foi processada.');
    }

    const status = input.status;
    if (status !== 'APPROVED' && status !== 'REJECTED') {
      throw new BadRequestException('Status de revisão inválido.');
    }

    let entitlementsAfter: Awaited<
      ReturnType<BillingService['getCurrentEntitlements']>
    > | null = null;
    if (status === 'APPROVED') {
      entitlementsAfter = await this.changePlan(
        request.tenantId,
        reviewer.userId,
        {
          planKey: request.requestedPlan.key,
          billingCycle: request.requestedBillingCycle,
          source: 'plan-request-approval',
          userEmail: reviewer.email || null,
        },
      );
    }

    const updated = await this.prisma.billingPlanChangeRequest.update({
      where: { id: request.id },
      data: {
        status,
        reviewedByUserId: reviewer.userId,
        reviewedByEmail: reviewer.email || null,
        reviewedAt: new Date(),
        resolutionNotes: input.resolutionNotes?.trim() || null,
      },
      include: {
        requestedPlan: { select: { id: true, key: true, name: true } },
      },
    });

    await this.audit.log(
      request.tenantId,
      'BILLING_PLAN_CHANGE_REQUEST_REVIEWED',
      reviewer.userId,
      undefined,
      {
        requestId: request.id,
        tenantName: request.tenant.name,
        requestedPlanKey: request.requestedPlan.key,
        requestedPlanName: request.requestedPlan.name,
        previousStatus: request.status,
        nextStatus: updated.status,
        resolutionNotes: updated.resolutionNotes || null,
        reviewerEmail: reviewer.email || null,
      },
    );

    return {
      request: {
        id: updated.id,
        status: updated.status,
        reviewedAt: updated.reviewedAt,
        resolutionNotes: updated.resolutionNotes,
        requestedPlan: updated.requestedPlan,
      },
      entitlementsAfter,
    };
  }

  async assertCanCreateUser(tenantId: string) {
    const data = await this.getCurrentEntitlements(tenantId);
    const { entitlements, usage } = data;
    if (
      entitlements.maxUsers != null &&
      usage.activeUsersCount >= entitlements.maxUsers
    ) {
      throw new BadRequestException(
        `Limite do plano atingido: seu plano permite até ${entitlements.maxUsers} usuário(s) ativo(s). Faça upgrade para adicionar mais usuários.`,
      );
    }
    return data;
  }

  async assertCanCreateMatter(tenantId: string) {
    const data = await this.getCurrentEntitlements(tenantId);
    const { entitlements, usage } = data;
    if (
      entitlements.maxMatters != null &&
      usage.mattersCount >= entitlements.maxMatters
    ) {
      throw new BadRequestException(
        `Limite do plano atingido: seu plano permite até ${entitlements.maxMatters} caso(s). Faça upgrade para cadastrar novos casos.`,
      );
    }
    return data;
  }
}
