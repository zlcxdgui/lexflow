const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function nextTenantCode(tx, tenantId, scope) {
  const row = await tx.tenantCodeCounter.upsert({
    where: { tenantId_scope: { tenantId, scope } },
    create: { tenantId, scope, value: 1 },
    update: { value: { increment: 1 } },
    select: { value: true },
  });
  return row.value;
}

async function main() {
  const plans = [
    {
      key: 'STARTER',
      name: 'Starter',
      description: 'Plano inicial para escritórios pequenos.',
      isSystem: true,
      maxUsers: 2,
      maxMatters: 100,
      storageLimitGb: 5,
      reportsAdvanced: false,
      auditExport: false,
      customAccessGroups: false,
      appointmentsModule: true,
      prioritySupport: false,
    },
    {
      key: 'PROFISSIONAL',
      name: 'Profissional',
      description: 'Plano recomendado para operação diária.',
      isSystem: true,
      maxUsers: 10,
      maxMatters: null,
      storageLimitGb: 50,
      reportsAdvanced: true,
      auditExport: true,
      customAccessGroups: true,
      appointmentsModule: true,
      prioritySupport: false,
    },
    {
      key: 'ESCRITORIO',
      name: 'Escritório',
      description: 'Plano completo para equipes maiores.',
      isSystem: true,
      maxUsers: null,
      maxMatters: null,
      storageLimitGb: 200,
      reportsAdvanced: true,
      auditExport: true,
      customAccessGroups: true,
      appointmentsModule: true,
      prioritySupport: true,
    },
    {
      key: 'TRIAL',
      name: 'Trial',
      description: 'Plano trial para homologação e validações internas.',
      isSystem: false,
      maxUsers: 3,
      maxMatters: 20,
      storageLimitGb: 2,
      reportsAdvanced: true,
      auditExport: true,
      customAccessGroups: true,
      appointmentsModule: true,
      prioritySupport: false,
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { key: plan.key },
      update: {
        name: plan.name,
        description: plan.description,
        isSystem: plan.isSystem,
        isActive: true,
        maxUsers: plan.maxUsers,
        maxMatters: plan.maxMatters,
        storageLimitGb: plan.storageLimitGb,
        reportsAdvanced: plan.reportsAdvanced,
        auditExport: plan.auditExport,
        customAccessGroups: plan.customAccessGroups,
        appointmentsModule: plan.appointmentsModule,
        prioritySupport: plan.prioritySupport,
      },
      create: {
        ...plan,
        isActive: true,
      },
    });
  }

  const passwordHash = await bcrypt.hash('123456', 10);

  const owner = await prisma.user.upsert({
    where: { email: 'owner@lexflow.dev' },
    update: {},
    create: {
      email: 'owner@lexflow.dev',
      name: 'Owner LexFlow',
      passwordHash,
    },
  });

  const lawyer = await prisma.user.upsert({
    where: { email: 'lawyer@lexflow.dev' },
    update: {},
    create: {
      email: 'lawyer@lexflow.dev',
      name: 'Lawyer LexFlow',
      passwordHash,
    },
  });

  const assistant = await prisma.user.upsert({
    where: { email: 'assistant@lexflow.dev' },
    update: {},
    create: {
      email: 'assistant@lexflow.dev',
      name: 'Assistant LexFlow',
      passwordHash,
    },
  });

  let tenant = await prisma.tenant.findFirst({ where: { name: 'LexFlow Demo' } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: 'LexFlow Demo',
      },
    });
  }

  const professionalPlan = await prisma.plan.findUnique({
    where: { key: 'PROFISSIONAL' },
  });
  if (professionalPlan) {
    const activeSub = await prisma.tenantSubscription.findFirst({
      where: {
        tenantId: tenant.id,
        status: { in: ['TRIAL', 'ACTIVE', 'PAST_DUE'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    const periodStart = new Date();
    const periodEnd = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

    if (!activeSub) {
      await prisma.tenantSubscription.create({
        data: {
          tenantId: tenant.id,
          planId: professionalPlan.id,
          status: 'TRIAL',
          billingCycle: 'MONTHLY',
          trialEndsAt: periodEnd,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
        },
      });
    } else {
      await prisma.tenantSubscription.update({
        where: { id: activeSub.id },
        data: {
          planId: professionalPlan.id,
          billingCycle: activeSub.billingCycle || 'MONTHLY',
        },
      });
    }
  }

  await prisma.tenantMember.upsert({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: owner.id,
      },
    },
    update: { role: 'OWNER', isActive: true },
    create: {
      code: await nextTenantCode(prisma, tenant.id, 'TENANT_MEMBER'),
      tenantId: tenant.id,
      userId: owner.id,
      role: 'OWNER',
      isActive: true,
    },
  });

  await prisma.tenantMember.upsert({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: lawyer.id,
      },
    },
    update: { role: 'LAWYER', isActive: true },
    create: {
      code: await nextTenantCode(prisma, tenant.id, 'TENANT_MEMBER'),
      tenantId: tenant.id,
      userId: lawyer.id,
      role: 'LAWYER',
      isActive: true,
    },
  });

  await prisma.tenantMember.upsert({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: assistant.id,
      },
    },
    update: { role: 'ASSISTANT', isActive: true },
    create: {
      code: await nextTenantCode(prisma, tenant.id, 'TENANT_MEMBER'),
      tenantId: tenant.id,
      userId: assistant.id,
      role: 'ASSISTANT',
      isActive: true,
    },
  });

  let client = await prisma.client.findFirst({
    where: { tenantId: tenant.id, name: 'Empresa Exemplo Ltda' },
  });
  if (!client) {
    client = await prisma.client.create({
      data: {
        code: await nextTenantCode(prisma, tenant.id, 'CLIENT'),
        tenantId: tenant.id,
        type: 'PJ',
        name: 'Empresa Exemplo Ltda',
        cnpj: '12345678000199',
        razaoSocial: 'Empresa Exemplo Ltda',
        nomeFantasia: 'Exemplo',
        contribuinte: 'CONTRIBUINTE_ICMS',
        inscricaoEstadual: '123.456.789.000',
        ufInscricaoEstadual: 'SP',
        email: 'contato@exemplo.com',
        phone: '+55 11 99999-0000',
        cep: '01001000',
        logradouro: 'Praça da Sé',
        numero: '100',
        complemento: 'Sala 10',
        bairro: 'Sé',
        cidade: 'São Paulo',
        uf: 'SP',
      },
    });
  }

  let matter = await prisma.matter.findFirst({
    where: { tenantId: tenant.id, title: 'Ação de Cobrança — Exemplo' },
  });
  if (!matter) {
    matter = await prisma.matter.create({
      data: {
        code: await nextTenantCode(prisma, tenant.id, 'MATTER'),
        tenantId: tenant.id,
        clientId: client.id,
        title: 'Ação de Cobrança — Exemplo',
        area: 'Cível',
        subject: 'Cobrança',
        court: 'TJSP',
        caseNumber: '0001234-56.2026.8.26.0100',
        status: 'OPEN',
      },
    });
  }

  await prisma.matterMember.upsert({
    where: { matterId_userId: { matterId: matter.id, userId: owner.id } },
    update: { memberRole: 'OWNER' },
    create: {
      tenantId: tenant.id,
      matterId: matter.id,
      userId: owner.id,
      memberRole: 'OWNER',
    },
  });

  await prisma.matterMember.upsert({
    where: { matterId_userId: { matterId: matter.id, userId: lawyer.id } },
    update: { memberRole: 'LAWYER' },
    create: {
      tenantId: tenant.id,
      matterId: matter.id,
      userId: lawyer.id,
      memberRole: 'LAWYER',
    },
  });

  await prisma.matterMember.upsert({
    where: { matterId_userId: { matterId: matter.id, userId: assistant.id } },
    update: { memberRole: 'ASSISTANT' },
    create: {
      tenantId: tenant.id,
      matterId: matter.id,
      userId: assistant.id,
      memberRole: 'ASSISTANT',
    },
  });

  const taskExists = await prisma.task.findFirst({
    where: { tenantId: tenant.id, matterId: matter.id, title: 'Revisar documentação inicial' },
  });
  if (!taskExists) {
    await prisma.task.create({
      data: {
        tenantId: tenant.id,
        matterId: matter.id,
        title: 'Revisar documentação inicial',
        description: 'Conferir documentos enviados pelo cliente.',
        status: 'OPEN',
        priority: 'HIGH',
        dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5),
        createdByUserId: owner.id,
        assignedToUserId: lawyer.id,
      },
    });
  }

  const deadlineExists = await prisma.deadline.findFirst({
    where: { tenantId: tenant.id, matterId: matter.id, title: 'Prazo para contestação' },
  });
  if (!deadlineExists) {
    await prisma.deadline.create({
      data: {
        tenantId: tenant.id,
        matterId: matter.id,
        title: 'Prazo para contestação',
        type: 'PROCESSUAL',
        dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 12),
        notes: 'Conferir prazo conforme publicação no diário.',
        isDone: false,
      },
    });
  }

  await prisma.tenantSubscriptionUsage.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: { tenantId: tenant.id },
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
