import { ApiError, apiGet } from '@/lib/serverApi';
import { AccessDeniedView } from '@/components/AccessDeniedView';
import { BackButton } from '@/components/BackButton';
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { BillingRequestButton } from './BillingActions';
import { BillingRequestsList } from './BillingRequestsList';
import { BillingToastHost } from './BillingToast';
import styles from './billing.module.css';

type MeProfile = {
  role?: string;
  tenantId?: string;
  email?: string;
};

type EntitlementsResponse = {
  tenantId: string;
  subscription: {
    id: string;
    status: string;
    billingCycle: string | null;
    trialEndsAt: string | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    graceEndsAt: string | null;
    cancelAtPeriodEnd: boolean;
    canceledAt: string | null;
  } | null;
  plan: {
    id: string;
    key: string;
    name: string;
    description: string | null;
    isActive: boolean;
  } | null;
  entitlements: {
    maxUsers: number | null;
    maxMatters: number | null;
    storageLimitGb: number | null;
    reportsAdvanced: boolean;
    auditExport: boolean;
    customAccessGroups: boolean;
    appointmentsModule: boolean;
    prioritySupport: boolean;
  };
  usage: {
    usersCount: number;
    activeUsersCount: number;
    mattersCount: number;
    storageBytes: number;
    lastRecalculatedAt: string;
  };
  limitsReached: {
    users: boolean;
    matters: boolean;
    storage: boolean;
  };
};

type PlanCatalogItem = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  entitlements: EntitlementsResponse['entitlements'];
};

function formatDate(value?: string | null) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR');
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[index]}`;
}

function usagePercent(current: number, max: number | null) {
  if (max == null || max <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((current / max) * 100)));
}

function percentTone(percent: number | null, reached: boolean) {
  if (reached) return styles.progressDanger;
  if (percent != null && percent >= 90) return styles.progressWarning;
  return styles.progressInfo;
}

function statusLabel(status?: string | null) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'TRIAL') return 'Trial';
  if (normalized === 'ACTIVE') return 'Ativo';
  if (normalized === 'PAST_DUE') return 'Pagamento pendente';
  if (normalized === 'CANCELED') return 'Cancelado';
  return normalized || 'Sem assinatura';
}

function cycleLabel(cycle?: string | null) {
  const normalized = String(cycle || '').toUpperCase();
  if (normalized === 'MONTHLY') return 'Mensal';
  if (normalized === 'YEARLY') return 'Anual';
  return '-';
}

function yesNo(value: boolean) {
  return value ? 'Sim' : 'Não';
}

function featureRows(item: PlanCatalogItem) {
  return [
    ['Relatórios avançados', yesNo(item.entitlements.reportsAdvanced)],
    ['Exportação de auditoria', yesNo(item.entitlements.auditExport)],
    ['Grupos de acesso personalizados', yesNo(item.entitlements.customAccessGroups)],
    ['Módulo de atendimento', yesNo(item.entitlements.appointmentsModule)],
    ['Suporte prioritário', yesNo(item.entitlements.prioritySupport)],
  ] as const;
}

export default async function BillingPage() {
  try {
    const me = await apiGet<MeProfile>('/me');
    const role = String(me.role || '').toUpperCase();
    const isAllowed = role === 'OWNER' || role === 'ADMIN';
    if (!isAllowed) {
      return (
        <main className={`${styles.page} appPageShell`}>
          <header className={styles.header}>
            <SectionHeader
              title="Planos e cobrança"
              description="Gestão de assinatura e limites do escritório."
              headingAs="h1"
              className={styles.headerTitleBlock}
            />
            <BackButton fallbackHref="/dashboard" className={styles.linkMuted} />
          </header>
          <AccessDeniedView area="Planos e cobrança" />
        </main>
      );
    }

    const [entitlements, plans, requests] = await Promise.all([
      apiGet<EntitlementsResponse>('/billing/entitlements/me'),
      apiGet<PlanCatalogItem[]>('/billing/plans'),
      apiGet<Array<{
        id: string;
        status: string;
        requestedBillingCycle: string;
        notes?: string | null;
        requestedByEmail?: string | null;
        reviewedByEmail?: string | null;
        reviewedAt?: string | null;
        resolutionNotes?: string | null;
        createdAt: string;
        requestedPlan: { id: string; key: string; name: string };
      }>>('/billing/requests/me'),
    ]);

    const storageLimitBytes =
      entitlements.entitlements.storageLimitGb != null
        ? entitlements.entitlements.storageLimitGb * 1024 * 1024 * 1024
        : null;
    const storagePercent = storageLimitBytes
      ? usagePercent(entitlements.usage.storageBytes, storageLimitBytes)
      : null;

    const cards = [
      {
        label: 'Usuários ativos',
        value: `${entitlements.usage.activeUsersCount}`,
        max: entitlements.entitlements.maxUsers,
        percent: usagePercent(entitlements.usage.activeUsersCount, entitlements.entitlements.maxUsers),
        reached: entitlements.limitsReached.users,
        helper: `${entitlements.usage.usersCount} usuário(s) total cadastrado(s)`,
      },
      {
        label: 'Casos',
        value: `${entitlements.usage.mattersCount}`,
        max: entitlements.entitlements.maxMatters,
        percent: usagePercent(entitlements.usage.mattersCount, entitlements.entitlements.maxMatters),
        reached: entitlements.limitsReached.matters,
        helper: 'Total de casos cadastrados no escritório',
      },
      {
        label: 'Armazenamento',
        value: formatBytes(entitlements.usage.storageBytes),
        max: entitlements.entitlements.storageLimitGb,
        percent: storagePercent,
        reached: entitlements.limitsReached.storage,
        helper: `Atualizado em ${formatDate(entitlements.usage.lastRecalculatedAt)}`,
      },
    ] as const;

    return (
      <main className={`${styles.page} appPageShell`}>
        <BillingToastHost />
        <header className={styles.header}>
          <SectionHeader
            title="Planos e cobrança"
            description="Gestão de assinatura, limites e recursos do escritório."
            headingAs="h1"
            className={styles.headerTitleBlock}
          />
          <BackButton fallbackHref="/dashboard" className={styles.linkMuted} />
        </header>

        <section className={styles.heroCard}>
          <div className={styles.heroMain}>
            <div className={styles.heroTopLine}>
              <span className={styles.heroLabel}>Plano atual</span>
              <span className={styles.heroPlan}>{entitlements.plan?.name || 'Sem plano'}</span>
              <span className={styles.heroStatus}>{statusLabel(entitlements.subscription?.status)}</span>
            </div>
            <div className={styles.heroMeta}>
              <span>Ciclo: {cycleLabel(entitlements.subscription?.billingCycle)}</span>
              <span>Período atual até: {formatDate(entitlements.subscription?.currentPeriodEnd)}</span>
              {entitlements.subscription?.trialEndsAt ? (
                <span>Trial até: {formatDate(entitlements.subscription.trialEndsAt)}</span>
              ) : null}
              {entitlements.subscription?.graceEndsAt ? (
                <span>Carência até: {formatDate(entitlements.subscription.graceEndsAt)}</span>
              ) : null}
            </div>
            {entitlements.plan?.description ? (
              <p className={styles.heroDescription}>{entitlements.plan.description}</p>
            ) : null}
          </div>
        </section>

        <Card as="section" className={styles.section} padding="md">
          <SectionHeader title="Uso do plano" className={styles.sectionHeaderUi} />
          <div className={styles.usageGrid}>
            {cards.map((card) => (
              <article key={card.label} className={styles.usageCard}>
                <div className={styles.usageLabel}>{card.label}</div>
                <div className={styles.usageValueLine}>
                  <strong className={styles.usageValue}>{card.value}</strong>
                  <span className={styles.usageMax}>
                    {card.max == null
                      ? 'Ilimitado'
                      : card.label === 'Armazenamento'
                        ? `/ ${card.max} GB`
                        : `/ ${card.max}`}
                  </span>
                </div>
                <div className={styles.progressTrack}>
                  <div
                    className={`${styles.progressFill} ${percentTone(card.percent, card.reached)}`}
                    style={{ width: `${card.percent ?? 100}%` }}
                  />
                </div>
                <div className={styles.usageFooter}>
                  <span>{card.percent == null ? 'Sem limite' : `${card.percent}% utilizado`}</span>
                  {card.reached ? <span className={styles.limitReached}>Limite atingido</span> : null}
                </div>
                <div className={styles.usageHelper}>{card.helper}</div>
              </article>
            ))}
          </div>
        </Card>

        <Card as="section" className={styles.section} padding="md">
          <SectionHeader title="Recursos liberados" className={styles.sectionHeaderUi} />
          <div className={styles.featuresGrid}>
            <div className={styles.featureItem}>
              <span>Relatórios avançados</span>
              <strong>{yesNo(entitlements.entitlements.reportsAdvanced)}</strong>
            </div>
            <div className={styles.featureItem}>
              <span>Exportação de auditoria</span>
              <strong>{yesNo(entitlements.entitlements.auditExport)}</strong>
            </div>
            <div className={styles.featureItem}>
              <span>Grupos de acesso personalizados</span>
              <strong>{yesNo(entitlements.entitlements.customAccessGroups)}</strong>
            </div>
            <div className={styles.featureItem}>
              <span>Módulo de atendimento</span>
              <strong>{yesNo(entitlements.entitlements.appointmentsModule)}</strong>
            </div>
            <div className={styles.featureItem}>
              <span>Suporte prioritário</span>
              <strong>{yesNo(entitlements.entitlements.prioritySupport)}</strong>
            </div>
          </div>
        </Card>

        <Card as="section" className={styles.section} padding="md">
          <SectionHeader title="Catálogo de planos" className={styles.sectionHeaderUi} />
          <div className={styles.planGrid}>
            {plans.map((plan) => {
              const isCurrent = plan.key === entitlements.plan?.key;
              const isTest = ['TESTE', 'TRIAL'].includes(plan.key.toUpperCase());
              return (
                <article
                  key={plan.id}
                  className={`${styles.planCard} ${isCurrent ? styles.planCardCurrent : ''}`}
                >
                  <div className={styles.planHeader}>
                    <div>
                      <div className={styles.planNameLine}>
                        <h2 className={styles.planName}>{plan.name}</h2>
                        {isCurrent ? <span className={styles.planBadgeCurrent}>Atual</span> : null}
                        {isTest ? <span className={styles.planBadgeTest}>Trial</span> : null}
                        {plan.isSystem ? <span className={styles.planBadgeSystem}>Padrão</span> : null}
                      </div>
                      <div className={styles.planKey}>{plan.key}</div>
                    </div>
                  </div>

                  <p className={styles.planDescription}>
                    {plan.description || 'Plano sem descrição cadastrada.'}
                  </p>

                  <div className={styles.planLimits}>
                    <div className={styles.planLimit}>
                      <span>Usuários</span>
                      <strong>{plan.entitlements.maxUsers ?? 'Ilimitado'}</strong>
                    </div>
                    <div className={styles.planLimit}>
                      <span>Casos</span>
                      <strong>{plan.entitlements.maxMatters ?? 'Ilimitado'}</strong>
                    </div>
                    <div className={styles.planLimit}>
                      <span>Armazenamento</span>
                      <strong>
                        {plan.entitlements.storageLimitGb == null
                          ? 'Ilimitado'
                          : `${plan.entitlements.storageLimitGb} GB`}
                      </strong>
                    </div>
                  </div>

                  <div className={styles.planFeatures}>
                    {featureRows(plan).map(([label, value]) => (
                      <div key={`${plan.id}-${label}`} className={styles.planFeatureRow}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                      </div>
                    ))}
                  </div>

                  <div className={styles.planActions}>
                    <BillingRequestButton planKey={plan.key} isCurrent={isCurrent} />
                  </div>
                </article>
              );
            })}
          </div>
        </Card>

        <Card as="section" className={styles.section} padding="md">
          <SectionHeader
            title="Solicitações de alteração de plano"
            description="Acompanhamento das últimas solicitações do escritório."
            className={styles.sectionHeaderUi}
          />
          <BillingRequestsList requests={requests} />
        </Card>
      </main>
    );
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      return (
        <main className={`${styles.page} appPageShell`}>
          <BillingToastHost />
          <header className={styles.header}>
            <SectionHeader
              title="Planos e cobrança"
              description="Gestão de assinatura e limites do escritório."
              headingAs="h1"
              className={styles.headerTitleBlock}
            />
            <BackButton fallbackHref="/dashboard" className={styles.linkMuted} />
          </header>
          <AccessDeniedView area="Planos e cobrança" />
        </main>
      );
    }
    const message = error instanceof Error ? error.message : 'Erro ao carregar planos e cobrança.';
    return (
      <main className={`${styles.page} appPageShell`}>
        <BillingToastHost />
        <header className={styles.header}>
          <SectionHeader
            title="Planos e cobrança"
            description="Gestão de assinatura e limites do escritório."
            headingAs="h1"
            className={styles.headerTitleBlock}
          />
          <BackButton fallbackHref="/dashboard" className={styles.linkMuted} />
        </header>
        <Card as="section" className={styles.errorCard} padding="sm">{message}</Card>
      </main>
    );
  }
}
