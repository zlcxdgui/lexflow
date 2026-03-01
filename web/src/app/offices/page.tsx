'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BackButton } from '@/components/BackButton';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Card } from '@/components/ui/Card';
import { UISelect } from '@/components/ui/Select';
import { OfficePlanRequestsList } from './OfficePlanRequestsList';
import styles from './offices.module.css';

type Me = {
  sub: string;
  tenantId: string;
  role: string;
  email: string;
};

type Office = {
  id: string;
  name: string;
  timezone?: string;
  createdAt: string;
  isActive: boolean;
  activeMembers: number;
};

type OfficeEntitlements = {
  plan: { key: string; name: string } | null;
  subscription: {
    status: string;
    billingCycle: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  usage: {
    activeUsersCount: number;
    mattersCount: number;
  };
  entitlements: {
    maxUsers: number | null;
    maxMatters: number | null;
  };
};

type BillingPlanCatalogItem = {
  id: string;
  key: string;
  name: string;
};

type OfficePlanChangeRequest = {
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
};

type PlatformAdmin = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR');
}

function getMessage(body: unknown, fallback: string) {
  if (typeof body === 'object' && body !== null) {
    const b = body as { message?: unknown; detail?: unknown };
    if (Array.isArray(b.message) && b.message[0]) return String(b.message[0]);
    if (typeof b.message === 'string') return b.message;
    if (typeof b.detail === 'string') return b.detail;
  }
  return fallback;
}

const OFFICE_TIMEZONE_OPTIONS = [
  { value: 'America/Manaus', label: '(UTC-04:00) Manaus' },
  { value: 'America/Sao_Paulo', label: '(UTC-03:00) Brasília' },
];

function formatOfficeTimezone(value?: string | null) {
  const found = OFFICE_TIMEZONE_OPTIONS.find((item) => item.value === value);
  return found?.label || '(UTC-04:00) Manaus';
}

export default function OfficesPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [offices, setOffices] = useState<Office[]>([]);
  const [platformAdmins, setPlatformAdmins] = useState<PlatformAdmin[]>([]);
  const [billingPlans, setBillingPlans] = useState<BillingPlanCatalogItem[]>([]);
  const [officeBilling, setOfficeBilling] = useState<Record<string, OfficeEntitlements | undefined>>({});
  const [officeBillingLoading, setOfficeBillingLoading] = useState<Record<string, boolean>>({});
  const [officeBillingPlanDraft, setOfficeBillingPlanDraft] = useState<Record<string, string>>({});
  const [officePlanRequests, setOfficePlanRequests] = useState<Record<string, OfficePlanChangeRequest[] | undefined>>({});
  const [officePlanRequestsLoading, setOfficePlanRequestsLoading] = useState<Record<string, boolean>>({});
  const [newName, setNewName] = useState('');
  const [newTimezone, setNewTimezone] = useState('America/Manaus');
  const [promoteEmail, setPromoteEmail] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingTimezone, setEditingTimezone] = useState('America/Manaus');
  const [confirmAction, setConfirmAction] = useState<
    | null
    | { type: 'promote'; email: string }
    | { type: 'demote'; userId: string; name: string }
  >(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const officesErrorId = 'offices-page-error';

  const isAdmin = useMemo(
    () => String(me?.role || '').toUpperCase() === 'ADMIN',
    [me?.role],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [meResp, officesResp] = await Promise.all([
        fetch('/api/auth/me', { cache: 'no-store' }),
        fetch('/api/tenants', { cache: 'no-store' }),
      ]);
      const meBody = await meResp.json().catch(() => null);
      if (!meResp.ok) throw new Error(getMessage(meBody, 'Sessão expirada.'));
      setMe(meBody);

      if (String(meBody?.role || '').toUpperCase() !== 'ADMIN') {
        setOffices([]);
        return;
      }

      const officesBody = await officesResp.json().catch(() => null);
      if (!officesResp.ok) {
        throw new Error(getMessage(officesBody, 'Não foi possível carregar escritórios.'));
      }
      setOffices(Array.isArray(officesBody) ? officesBody : []);

      const plansResp = await fetch('/api/billing/plans', { cache: 'no-store' });
      const plansBody = await plansResp.json().catch(() => null);
      if (!plansResp.ok) {
        throw new Error(getMessage(plansBody, 'Não foi possível carregar planos.'));
      }
      setBillingPlans(Array.isArray(plansBody) ? plansBody : []);

      const adminsResp = await fetch('/api/users/platform-admins', { cache: 'no-store' });
      const adminsBody = await adminsResp.json().catch(() => null);
      if (!adminsResp.ok) {
        throw new Error(getMessage(adminsBody, 'Não foi possível carregar admins de plataforma.'));
      }
      setPlatformAdmins(Array.isArray(adminsBody) ? adminsBody : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar escritórios.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOfficeBilling = useCallback(async (tenantId: string) => {
    setOfficeBillingLoading((prev) => ({ ...prev, [tenantId]: true }));
    try {
      const resp = await fetch(`/api/billing/admin/tenants/${tenantId}/entitlements`, {
        cache: 'no-store',
      });
      const body = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(getMessage(body, 'Não foi possível carregar assinatura do escritório.'));
      setOfficeBilling((prev) => ({ ...prev, [tenantId]: body as OfficeEntitlements }));
      setOfficeBillingPlanDraft((prev) => ({
        ...prev,
        [tenantId]: String((body as OfficeEntitlements)?.plan?.key || prev[tenantId] || ''),
      }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar assinatura do escritório.');
    } finally {
      setOfficeBillingLoading((prev) => ({ ...prev, [tenantId]: false }));
    }
  }, []);

  const loadOfficePlanRequests = useCallback(async (tenantId: string) => {
    setOfficePlanRequestsLoading((prev) => ({ ...prev, [tenantId]: true }));
    try {
      const resp = await fetch(`/api/billing/admin/tenants/${tenantId}/requests`, { cache: 'no-store' });
      const body = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(getMessage(body, 'Não foi possível carregar solicitações de plano.'));
      setOfficePlanRequests((prev) => ({ ...prev, [tenantId]: Array.isArray(body) ? (body as OfficePlanChangeRequest[]) : [] }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar solicitações de plano.');
    } finally {
      setOfficePlanRequestsLoading((prev) => ({ ...prev, [tenantId]: false }));
    }
  }, []);

  useEffect(() => {
    if (!isAdmin || offices.length === 0) return;
    offices.forEach((office) => {
      if (!officeBilling[office.id] && !officeBillingLoading[office.id]) {
        void loadOfficeBilling(office.id);
      }
      if (!officePlanRequests[office.id] && !officePlanRequestsLoading[office.id]) {
        void loadOfficePlanRequests(office.id);
      }
    });
  }, [
    isAdmin,
    offices,
    officeBilling,
    officeBillingLoading,
    officePlanRequests,
    officePlanRequestsLoading,
    loadOfficeBilling,
    loadOfficePlanRequests,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  const createOffice = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const resp = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), timezone: newTimezone }),
      });
      const body = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(getMessage(body, 'Não foi possível criar escritório.'));
      setNewName('');
      setNewTimezone('America/Manaus');
      setSuccess('Escritório criado com sucesso.');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Não foi possível criar escritório.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (office: Office) => {
    setEditingId(office.id);
    setEditingName(office.name);
    setEditingTimezone(String(office.timezone || 'America/Manaus'));
  };

  const saveEdit = async (officeId: string) => {
    if (!editingName.trim()) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const resp = await fetch(`/api/tenants/${officeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingName.trim(), timezone: editingTimezone }),
      });
      const body = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(getMessage(body, 'Não foi possível renomear escritório.'));
      setEditingId(null);
      setEditingName('');
      setEditingTimezone('America/Manaus');
      setSuccess('Escritório renomeado.');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Não foi possível renomear escritório.');
    } finally {
      setSaving(false);
    }
  };

  const deactivateOffice = async (office: Office) => {
    const confirmed = window.confirm(`Desativar o escritório "${office.name}"?`);
    if (!confirmed) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const resp = await fetch(`/api/tenants/${office.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false }),
      });
      const body = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(getMessage(body, 'Não foi possível desativar escritório.'));
      setSuccess('Escritório desativado.');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Não foi possível desativar escritório.');
    } finally {
      setSaving(false);
    }
  };

  const reactivateOffice = async (office: Office) => {
    const confirmed = window.confirm(`Reativar o escritório "${office.name}"?`);
    if (!confirmed) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const resp = await fetch(`/api/tenants/${office.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      });
      const body = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(getMessage(body, 'Não foi possível reativar escritório.'));
      setSuccess('Escritório reativado.');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Não foi possível reativar escritório.');
    } finally {
      setSaving(false);
    }
  };

  const switchOffice = async (officeId: string) => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const resp = await fetch('/api/tenants/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: officeId }),
      });
      const body = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(getMessage(body, 'Não foi possível alternar escritório.'));
      router.replace('/dashboard');
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Não foi possível alternar escritório.');
    } finally {
      setSaving(false);
    }
  };

  const promoteAdmin = async (email: string) => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const resp = await fetch('/api/users/platform-admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const body = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(getMessage(body, 'Não foi possível promover admin.'));
      setPromoteEmail('');
      setSuccess('Admin de plataforma promovido com sucesso.');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Não foi possível promover admin.');
    } finally {
      setSaving(false);
    }
  };

  const demoteAdmin = async (userId: string) => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const resp = await fetch('/api/users/platform-admins/demote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const body = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(getMessage(body, 'Não foi possível remover admin.'));
      setSuccess('Admin de plataforma removido com sucesso.');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Não foi possível remover admin.');
    } finally {
      setSaving(false);
    }
  };

  const changeOfficePlan = async (tenantId: string) => {
    const planKey = String(officeBillingPlanDraft[tenantId] || '').trim();
    if (!planKey) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const resp = await fetch(`/api/billing/admin/tenants/${tenantId}/change-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planKey, billingCycle: 'MONTHLY' }),
      });
      const body = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(getMessage(body, 'Não foi possível alterar o plano do escritório.'));
      setSuccess('Plano do escritório alterado com sucesso.');
      await loadOfficeBilling(tenantId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Não foi possível alterar o plano do escritório.');
    } finally {
      setSaving(false);
    }
  };

  const toggleOfficeCancelAtPeriodEnd = async (tenantId: string) => {
    const current = officeBilling[tenantId];
    if (!current?.subscription) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const resp = await fetch(`/api/billing/admin/tenants/${tenantId}/cancel-at-period-end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancelAtPeriodEnd: !current.subscription.cancelAtPeriodEnd }),
      });
      const body = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(getMessage(body, 'Não foi possível atualizar cancelamento da assinatura.'));
      setSuccess('Configuração de cancelamento da assinatura atualizada.');
      await loadOfficeBilling(tenantId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Não foi possível atualizar cancelamento da assinatura.');
    } finally {
      setSaving(false);
    }
  };

  const reviewOfficePlanRequest = async (
    tenantId: string,
    requestId: string,
    status: 'APPROVED' | 'REJECTED',
  ) => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const resp = await fetch(`/api/billing/admin/requests/${requestId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const body = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(getMessage(body, 'Não foi possível revisar solicitação de plano.'));
      setSuccess(status === 'APPROVED' ? 'Solicitação aprovada.' : 'Solicitação rejeitada.');
      await Promise.all([loadOfficePlanRequests(tenantId), loadOfficeBilling(tenantId)]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Não foi possível revisar solicitação de plano.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className={`${styles.page} appPageShell`}>
      <header className={styles.header}>
        <SectionHeader
          title="Escritórios"
          description="Gerencie escritórios, alternância e status."
          headingAs="h1"
          className={styles.headerTitleBlock}
        />
        <BackButton fallbackHref="/dashboard" className={styles.linkMuted} />
      </header>

      {error ? <div id={officesErrorId} className={styles.error}>{error}</div> : null}
      {success ? <div className={styles.success}>{success}</div> : null}

      {!loading && !isAdmin ? (
        <Card as="section" className={styles.card} padding="md">
          <div className={styles.muted}>Sem autorização. Entre em contato com seu owner/admin.</div>
        </Card>
      ) : null}

      {isAdmin ? (
        <>
          <Card as="section" className={styles.card} padding="md">
            <SectionHeader
              title="Admins de plataforma"
              className={styles.sectionHeaderUi}
            />
            <form
              className={styles.createRow}
              onSubmit={(event) => {
                event.preventDefault();
                const email = promoteEmail.trim().toLowerCase();
                if (!email) return;
                setConfirmAction({ type: 'promote', email });
              }}
            >
              <label className={styles.field}>
                <span>Promover por e-mail</span>
                <input
                  type="email"
                  value={promoteEmail}
                  onChange={(event) => setPromoteEmail(event.target.value)}
                  placeholder="usuario@empresa.com"
                  required
                  aria-describedby={error ? officesErrorId : undefined}
                />
              </label>
              <button className={styles.primaryButton} type="submit" disabled={saving}>
                Promover admin
              </button>
            </form>

            <div className={styles.list}>
              {platformAdmins.map((admin) => {
                const isSelf = admin.id === me?.sub;
                return (
                  <div key={admin.id} className={styles.item}>
                    <div className={styles.itemMain}>
                      <div className={styles.nameLine}>
                        <strong className={styles.name}>{admin.name}</strong>
                        <span className={styles.badgeActive}>Admin</span>
                        {isSelf ? <span className={styles.badgeCurrent}>Seu usuário</span> : null}
                      </div>
                      <div className={styles.meta}>
                        {admin.email} · desde {formatDate(admin.createdAt)}
                      </div>
                    </div>
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={styles.dangerButton}
                        disabled={saving || isSelf}
                        onClick={() =>
                          setConfirmAction({
                            type: 'demote',
                            userId: admin.id,
                            name: admin.name,
                          })
                        }
                      >
                        Remover admin
                      </button>
                    </div>
                  </div>
                );
              })}
              {platformAdmins.length === 0 ? (
                <div className={styles.muted}>Nenhum admin de plataforma.</div>
              ) : null}
            </div>
          </Card>

          <Card as="section" className={styles.card} padding="md">
            <form onSubmit={createOffice} className={styles.createRow} suppressHydrationWarning>
              <label className={styles.field}>
                <span>Novo escritório</span>
                <input
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="Nome do escritório"
                  required
                  aria-describedby={error ? officesErrorId : undefined}
                />
              </label>
              <label className={styles.field}>
                <span>Fuso horário</span>
                <UISelect
                  value={newTimezone}
                  onChange={setNewTimezone}
                  ariaLabel="Fuso horário"
                  ariaDescribedBy={error ? officesErrorId : undefined}
                  options={OFFICE_TIMEZONE_OPTIONS}
                />
              </label>
              <button className={styles.primaryButton} type="submit" disabled={saving}>
                Criar escritório
              </button>
            </form>
          </Card>

          <Card as="section" className={styles.card} padding="md">
            {loading ? <div className={styles.muted}>Carregando...</div> : null}
            {!loading && offices.length === 0 ? (
              <div className={styles.muted}>Nenhum escritório encontrado.</div>
            ) : null}
            {!loading && offices.length > 0 ? (
              <div className={styles.list}>
                {offices.map((office) => {
                  const isCurrent = office.id === me?.tenantId;
                  const billing = officeBilling[office.id];
                  const billingLoading = officeBillingLoading[office.id];
                  const billingDraft = officeBillingPlanDraft[office.id] || billing?.plan?.key || '';
                  const planRequests = officePlanRequests[office.id] || [];
                  const planRequestsLoading = officePlanRequestsLoading[office.id];
                  return (
                    <div key={office.id} className={styles.item}>
                      <div className={styles.itemMain}>
                        {editingId === office.id ? (
                          <div className={styles.editRow}>
                            <input
                              value={editingName}
                              onChange={(event) => setEditingName(event.target.value)}
                              className={styles.editInput}
                              aria-describedby={error ? officesErrorId : undefined}
                            />
                            <UISelect
                              value={editingTimezone}
                              onChange={setEditingTimezone}
                              className={styles.editInput}
                              ariaLabel="Fuso horário do escritório"
                              ariaDescribedBy={error ? officesErrorId : undefined}
                              options={OFFICE_TIMEZONE_OPTIONS}
                            />
                            <button
                              type="button"
                              className={styles.secondaryButton}
                              onClick={() => saveEdit(office.id)}
                              disabled={saving}
                            >
                              Salvar
                            </button>
                            <button
                              type="button"
                              className={styles.ghostButton}
                              onClick={() => {
                                setEditingId(null);
                                setEditingName('');
                              }}
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div className={styles.nameLine}>
                            <strong className={styles.name}>{office.name}</strong>
                            <span className={office.isActive ? styles.badgeActive : styles.badgeInactive}>
                              {office.isActive ? 'Ativo' : 'Desativado'}
                            </span>
                            {isCurrent ? <span className={styles.badgeCurrent}>Atual</span> : null}
                          </div>
                        )}
                        <div className={styles.meta}>
                          Criado em {formatDate(office.createdAt)} · {office.activeMembers} membro(s) ativo(s) · Fuso: {formatOfficeTimezone(office.timezone)}
                        </div>
                        <div className={styles.officeBillingBox}>
                          <div className={styles.officeBillingHead}>
                            <strong>Assinatura</strong>
                            {billingLoading ? <span className={styles.muted}>Carregando...</span> : null}
                          </div>
                          {billing ? (
                            <>
                              <div className={styles.officeBillingMeta}>
                                <span>Plano: {billing.plan?.name || 'Sem plano'}</span>
                                <span>Status: {String(billing.subscription?.status || '-').toUpperCase()}</span>
                                <span>Ciclo: {billing.subscription?.billingCycle === 'YEARLY' ? 'Anual' : billing.subscription?.billingCycle === 'MONTHLY' ? 'Mensal' : '-'}</span>
                                <span>Período até: {formatDate(billing.subscription?.currentPeriodEnd || '')}</span>
                                {billing.subscription ? (
                                  <span>
                                    Renovação: {billing.subscription.cancelAtPeriodEnd ? 'Cancelada no fim do período' : 'Automática'}
                                  </span>
                                ) : null}
                              </div>
                              <div className={styles.officeBillingUsage}>
                                <span>
                                  Usuários: {billing.usage.activeUsersCount}/{billing.entitlements.maxUsers ?? '∞'}
                                </span>
                                <span>
                                  Casos: {billing.usage.mattersCount}/{billing.entitlements.maxMatters ?? '∞'}
                                </span>
                              </div>
                              <div className={styles.officeBillingControls}>
                                <UISelect
                                  className={styles.billingSelect}
                                  value={billingDraft}
                                  ariaLabel="Plano do escritório"
                                  ariaDescribedBy={error ? officesErrorId : undefined}
                                  loading={billingLoading}
                                  loadingLabel="Carregando planos..."
                                  onChange={(value) =>
                                    setOfficeBillingPlanDraft((prev) => ({
                                      ...prev,
                                      [office.id]: value,
                                    }))
                                  }
                                  disabled={saving}
                                  options={[
                                    { value: '', label: 'Selecione um plano' },
                                    ...billingPlans.map((plan) => ({
                                      value: plan.key,
                                      label: `${plan.name} (${plan.key})`,
                                    })),
                                  ]}
                                />
                                <button
                                  type="button"
                                  className={styles.secondaryButton}
                                  onClick={() => changeOfficePlan(office.id)}
                                  disabled={saving || !billingDraft}
                                >
                                  Alterar plano
                                </button>
                                <button
                                  type="button"
                                  className={styles.ghostButton}
                                  onClick={() => toggleOfficeCancelAtPeriodEnd(office.id)}
                                  disabled={saving || !billing.subscription}
                                >
                                  {billing.subscription?.cancelAtPeriodEnd
                                    ? 'Reativar renovação'
                                    : 'Cancelar no fim do período'}
                                </button>
                                <button
                                  type="button"
                                  className={styles.ghostButton}
                                  onClick={() => loadOfficeBilling(office.id)}
                                  disabled={saving || billingLoading}
                                >
                                  Atualizar assinatura
                                </button>
                              </div>
                              <div className={styles.officeRequestsBox}>
                                <div className={styles.officeRequestsHead}>
                                  <strong>Solicitações de plano</strong>
                                  {planRequestsLoading ? <span className={styles.muted}>Carregando...</span> : null}
                                </div>
                                <OfficePlanRequestsList
                                  requests={planRequests}
                                  saving={saving}
                                  onApprove={(requestId) =>
                                    reviewOfficePlanRequest(office.id, requestId, 'APPROVED')
                                  }
                                  onReject={(requestId) =>
                                    reviewOfficePlanRequest(office.id, requestId, 'REJECTED')
                                  }
                                />
                              </div>
                            </>
                          ) : (
                            <div className={styles.muted}>Assinatura ainda não carregada.</div>
                          )}
                        </div>
                      </div>
                      <div className={styles.actions}>
                        {office.isActive && !isCurrent ? (
                          <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={() => switchOffice(office.id)}
                            disabled={saving}
                          >
                            Alternar
                          </button>
                        ) : null}
                        {office.isActive ? (
                          <button
                            type="button"
                            className={styles.ghostButton}
                            onClick={() => startEdit(office)}
                            disabled={saving || editingId === office.id}
                          >
                            Renomear
                          </button>
                        ) : null}
                        {office.isActive ? (
                          <button
                            type="button"
                            className={styles.dangerButton}
                            onClick={() => deactivateOffice(office)}
                            disabled={saving}
                          >
                            Desativar
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={() => reactivateOffice(office)}
                            disabled={saving}
                          >
                            Reativar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </Card>
        </>
      ) : null}

      {confirmAction ? (
        <div
          className={styles.modalOverlay}
          onClick={() => {
            if (!saving) setConfirmAction(null);
          }}
        >
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalTitle}>
              {confirmAction.type === 'promote' ? 'Promover admin' : 'Remover admin'}
            </div>
            <div className={styles.modalText}>
              {confirmAction.type === 'promote'
                ? `Confirmar promoção para admin de plataforma: ${confirmAction.email}?`
                : `Confirmar remoção de admin de plataforma: ${confirmAction.name}?`}
            </div>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.ghostButton}
                disabled={saving}
                onClick={() => setConfirmAction(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={confirmAction.type === 'promote' ? styles.primaryButton : styles.dangerButton}
                disabled={saving}
                onClick={async () => {
                  const action = confirmAction;
                  setConfirmAction(null);
                  if (action.type === 'promote') await promoteAdmin(action.email);
                  if (action.type === 'demote') await demoteAdmin(action.userId);
                }}
              >
                {confirmAction.type === 'promote' ? 'Confirmar promoção' : 'Confirmar remoção'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
