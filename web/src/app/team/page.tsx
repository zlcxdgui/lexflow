'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ActionMenu } from '@/components/ActionMenu';
import { AccessDeniedView } from '@/components/AccessDeniedView';
import { BackButton } from '@/components/BackButton';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { UIButton } from '@/components/ui/Button';
import { UIListEmpty, UIListPager, UIListPagerPage } from '@/components/ui/ListRow';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { UISelect } from '@/components/ui/Select';
import {
  ACCESS_DENIED_MESSAGE,
  extractErrorMessage as parseErrorMessage,
} from '@/lib/errorMessage';
import styles from './team.module.css';

type Me = {
  sub: string;
  tenantId: string;
  role: 'ADMIN' | 'OWNER' | 'LAWYER' | 'ASSISTANT';
  email: string;
  permissions?: string[];
};

type Member = {
  id: string;
  code?: number | null;
  role: 'OWNER' | 'LAWYER' | 'ASSISTANT';
  isActive: boolean;
  isTemporarilyLocked?: boolean;
  permissions?: {
    isSelf: boolean;
    isLastActiveOwner: boolean;
    canChangeRole: boolean;
    canDeactivate: boolean;
  };
  user: {
    id: string;
    name: string;
    email: string;
  };
};

type PendingInvite = {
  id: string;
  email: string;
  fullName: string;
  role: Member['role'];
  expiresAt: string;
};

type AccessGroup = {
  id: string;
  code: number;
  key: string | null;
  name: string;
  isSystem: boolean;
  isActive: boolean;
  permissions: string[];
};

type GridRow =
  | {
      kind: 'invite';
      id: string;
      code: string;
      name: string;
      email: string;
      role: Member['role'];
      status: 'PENDING';
      expiresAt: string;
    }
  | {
      kind: 'member';
      id: string;
      code: string;
      name: string;
      email: string;
      role: Member['role'];
      status: 'ACTIVE' | 'INACTIVE';
      isSelf: boolean;
      canDeactivate: boolean;
      hasPendingActivation: boolean;
      isTemporarilyLocked: boolean;
    };

const ROLE_LABEL: Record<Member['role'], string> = {
  OWNER: 'Sócio',
  LAWYER: 'Advogado',
  ASSISTANT: 'Assistente',
};

function roleBadgeClass(role: Member['role']) {
  if (role === 'OWNER') return styles.roleOwner;
  if (role === 'LAWYER') return styles.roleLawyer;
  return styles.roleAssistant;
}

export default function TeamPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [updating, setUpdating] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PENDING' | 'INACTIVE'>('ALL');
  const [roleFilter, setRoleFilter] = useState<'ALL' | Member['role']>('ALL');
  const [groupBy, setGroupBy] = useState<'NONE' | 'STATUS' | 'ROLE'>('NONE');
  const [sortBy, setSortBy] = useState<'status' | 'code' | 'name' | 'role'>('code');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [activeTab, setActiveTab] = useState<'members' | 'groups'>('members');
  const [accessGroups, setAccessGroups] = useState<AccessGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    | null
    | {
        type:
          | 'deactivate'
          | 'reactivate'
          | 'unlock'
          | 'cancelInvite'
          | 'deleteGroup';
        id: string;
        label: string;
      }
  >(null);
  const canUpdateTeam =
    me?.role === 'ADMIN' || Boolean(me?.permissions?.includes('team.update'));

  const extractErrorMessage = async (resp: Response, fallback: string) => {
    const text = await resp.text().catch(() => '');
    return parseErrorMessage(text, fallback, resp.status);
  };

  const fetchMembers = useCallback(async (currentTenantId?: string) => {
    if (!currentTenantId || currentTenantId === 'undefined') return;
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`/api/tenants/${currentTenantId}/members`);
      if (!resp.ok) {
        throw new Error(await extractErrorMessage(resp, 'Não foi possível carregar a equipe.'));
      }
      const data = await resp.json();
      setMembers(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar a equipe.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPendingInvites = useCallback(async (currentTenantId?: string) => {
    if (!currentTenantId || currentTenantId === 'undefined') return;
    try {
      const resp = await fetch(`/api/tenants/${currentTenantId}/invites/pending`);
      if (resp.status === 404) {
        setPendingInvites([]);
        return;
      }
      if (!resp.ok) {
        throw new Error(await extractErrorMessage(resp, 'Não foi possível carregar convites pendentes.'));
      }
      const data = await resp.json();
      setPendingInvites(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      setPendingInvites([]);
      setError(err instanceof Error ? err.message : 'Não foi possível carregar convites pendentes.');
    }
  }, []);

  const fetchAccessGroups = useCallback(async (currentTenantId?: string) => {
    if (!currentTenantId || currentTenantId === 'undefined') return;
    setGroupsLoading(true);
    try {
      const resp = await fetch(`/api/tenants/${currentTenantId}/access-groups`);
      if (!resp.ok) {
        throw new Error(
          await extractErrorMessage(
            resp,
            'Não foi possível carregar grupos de acesso.',
          ),
        );
      }
      const data = await resp.json().catch(() => []);
      setAccessGroups(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar grupos de acesso.',
      );
    } finally {
      setGroupsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [meResp, tenantsResp] = await Promise.all([
          fetch('/api/auth/me'),
          fetch('/api/tenants/mine'),
        ]);

        const meData = await meResp.json().catch(() => null);
        const tenantsData = await tenantsResp.json().catch(() => []);
        if (!active) return;

        if (meResp.ok && meData?.tenantId) {
          setMe(meData);
        }

        const list = Array.isArray(tenantsData) ? tenantsData : [];
        const candidate =
          (meData?.tenantId && list.find((t: { tenantId: string }) => t.tenantId === meData.tenantId))
            ? meData.tenantId
            : list[0]?.tenantId;

        if (candidate) {
          setTenantId(candidate);
          fetchMembers(candidate);
          fetchPendingInvites(candidate);
          fetchAccessGroups(candidate);
          return;
        }

        setError('Sem escritório ativo.');
        setLoading(false);
      } catch {
        if (!active) return;
        setError('Sessão expirada.');
        setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [fetchAccessGroups, fetchMembers, fetchPendingInvites]);


  const removeGroup = async (groupId: string) => {
    if (!tenantId) return;
    setError(null);
    setSuccess(null);
    try {
      const resp = await fetch(
        `/api/tenants/${tenantId}/access-groups/${groupId}`,
        { method: 'DELETE' },
      );
      if (!resp.ok) {
        throw new Error(
          await extractErrorMessage(resp, 'Não foi possível excluir grupo.'),
        );
      }
      await fetchAccessGroups(tenantId);
      setSuccess('Grupo de acesso excluído.');
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível excluir grupo.',
      );
    }
  };

  const handleUpdate = async (memberId: string, payload: Partial<Member>) => {
    if (!tenantId) return;
    setUpdating((prev) => ({ ...prev, [memberId]: true }));
    setError(null);
    setSuccess(null);
    try {
      const resp = await fetch(`/api/tenants/${tenantId}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        throw new Error(await extractErrorMessage(resp, 'Não foi possível atualizar.'));
      }
      await Promise.all([fetchMembers(tenantId), fetchPendingInvites(tenantId)]);
      setSuccess('Membro atualizado com sucesso.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Não foi possível atualizar.');
    } finally {
      setUpdating((prev) => ({ ...prev, [memberId]: false }));
    }
  };

  const handleDeactivate = async (memberId: string) => {
    setConfirmAction({ type: 'deactivate', id: memberId, label: 'Desativar este usuário?' });
  };

  const handleReactivate = async (memberId: string) => {
    setConfirmAction({ type: 'reactivate', id: memberId, label: 'Reativar este usuário?' });
  };

  const handleUnlock = async (memberId: string) => {
    if (!tenantId) return;
    setUpdating((prev) => ({ ...prev, [memberId]: true }));
    setError(null);
    setSuccess(null);
    try {
      const resp = await fetch(`/api/tenants/${tenantId}/members/${memberId}/unlock`, {
        method: 'POST',
      });
      if (!resp.ok) throw new Error(await extractErrorMessage(resp, 'Não foi possível desbloquear usuário.'));
      const data = await resp.json().catch(() => null);
      setSuccess(data?.message || 'Usuário desbloqueado com sucesso.');
      await fetchMembers(tenantId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Não foi possível desbloquear usuário.');
    } finally {
      setUpdating((prev) => ({ ...prev, [memberId]: false }));
    }
  };

  const handleDeleteGroup = (group: AccessGroup) => {
    setConfirmAction({
      type: 'deleteGroup',
      id: group.id,
      label: `Excluir grupo "${group.name}"?`,
    });
  };

  const handleResendActivation = async (memberId: string) => {
    if (!tenantId) return;
    setUpdating((prev) => ({ ...prev, [memberId]: true }));
    setError(null);
    setSuccess(null);
    try {
      const resp = await fetch(`/api/tenants/${tenantId}/members/${memberId}/resend-activation`, {
        method: 'POST',
      });
      if (!resp.ok) throw new Error(await extractErrorMessage(resp, 'Não foi possível reenviar ativação.'));
      const data = await resp.json().catch(() => null);
      setSuccess(data?.message || 'E-mail de ativação reenviado.');
      await fetchPendingInvites(tenantId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Não foi possível reenviar ativação.');
    } finally {
      setUpdating((prev) => ({ ...prev, [memberId]: false }));
    }
  };

  const handleResendPendingInvite = async (inviteId: string) => {
    if (!tenantId) return;
    setUpdating((prev) => ({ ...prev, [inviteId]: true }));
    setError(null);
    setSuccess(null);
    try {
      const resp = await fetch(`/api/tenants/${tenantId}/invites/${inviteId}/resend`, { method: 'POST' });
      if (!resp.ok) throw new Error(await extractErrorMessage(resp, 'Não foi possível reenviar convite.'));
      const data = await resp.json().catch(() => null);
      setSuccess(data?.message || 'Convite reenviado por e-mail.');
      await fetchPendingInvites(tenantId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Não foi possível reenviar convite.');
    } finally {
      setUpdating((prev) => ({ ...prev, [inviteId]: false }));
    }
  };

  const handleCancelPendingInvite = async (inviteId: string) => {
    if (!tenantId) return;
    setUpdating((prev) => ({ ...prev, [inviteId]: true }));
    setError(null);
    setSuccess(null);
    try {
      const resp = await fetch(`/api/tenants/${tenantId}/invites/${inviteId}`, { method: 'DELETE' });
      if (!resp.ok) throw new Error(await extractErrorMessage(resp, 'Não foi possível cancelar convite.'));
      const data = await resp.json().catch(() => null);
      setSuccess(data?.message || 'Convite cancelado.');
      await fetchPendingInvites(tenantId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Não foi possível cancelar convite.');
    } finally {
      setUpdating((prev) => ({ ...prev, [inviteId]: false }));
    }
  };

  const grouped = useMemo(() => {
    const active = members
      .filter((m) => m.isActive)
      .sort((a, b) => {
        const aSelf = a.user.id === me?.sub ? 1 : 0;
        const bSelf = b.user.id === me?.sub ? 1 : 0;
        return bSelf - aSelf;
      });
    const inactive = members.filter((m) => !m.isActive);
    return { active, inactive };
  }, [members, me?.sub]);

  const gridRows = useMemo<GridRow[]>(() => {
    const activeRows: GridRow[] = grouped.active.map((member) => {
      const isSelf = member.user.id === me?.sub;
      const hasPendingActivation = pendingInvites.some(
        (invite) => invite.email.toLowerCase() === member.user.email.toLowerCase(),
      );
      return {
        kind: 'member',
        id: member.id,
        code: member.code ? String(member.code) : '-',
        name: member.user.name,
        email: member.user.email,
        role: member.role,
        status: 'ACTIVE',
        isSelf,
        canDeactivate: Boolean(member.permissions?.canDeactivate),
        hasPendingActivation,
        isTemporarilyLocked: Boolean(member.isTemporarilyLocked),
      };
    });

    const pendingRows: GridRow[] = pendingInvites.map((invite, idx) => ({
      kind: 'invite',
      id: invite.id,
      code: `P${idx + 1}`,
      name: invite.fullName,
      email: invite.email,
      role: invite.role,
      status: 'PENDING',
      expiresAt: invite.expiresAt,
    }));

    const inactiveRows: GridRow[] = grouped.inactive.map((member) => ({
      kind: 'member',
      id: member.id,
      code: member.code ? String(member.code) : '-',
      name: member.user.name,
      email: member.user.email,
      role: member.role,
      status: 'INACTIVE',
      isSelf: false,
      canDeactivate: false,
      hasPendingActivation: false,
      isTemporarilyLocked: false,
    }));

    return [...activeRows, ...pendingRows, ...inactiveRows];
  }, [grouped.active, grouped.inactive, pendingInvites, me?.sub]);

  const filteredGridRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return gridRows.filter((row) => {
      if (statusFilter !== 'ALL' && row.status !== statusFilter) return false;
      if (roleFilter !== 'ALL' && row.role !== roleFilter) return false;
      if (!q) return true;
      const hay = `${row.code} ${row.name} ${row.email} ${ROLE_LABEL[row.role]}`.toLowerCase();
      return hay.includes(q);
    });
  }, [gridRows, query, roleFilter, statusFilter]);

  const sortedGridRows = useMemo(() => {
    const statusRank: Record<GridRow['status'], number> = {
      ACTIVE: 1,
      PENDING: 2,
      INACTIVE: 3,
    };
    const roleRank: Record<Member['role'], number> = {
      OWNER: 1,
      LAWYER: 2,
      ASSISTANT: 3,
    };
    const signal = sortDir === 'asc' ? 1 : -1;
    const list = [...filteredGridRows];
    list.sort((a, b) => {
      if (sortBy === 'status') return (statusRank[a.status] - statusRank[b.status]) * signal;
      if (sortBy === 'code') return a.code.localeCompare(b.code, 'pt-BR', { numeric: true }) * signal;
      if (sortBy === 'role') return (roleRank[a.role] - roleRank[b.role]) * signal;
      return a.name.localeCompare(b.name, 'pt-BR') * signal;
    });
    return list;
  }, [filteredGridRows, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedGridRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = sortedGridRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const groupedPagedRows = useMemo(() => {
    if (groupBy === 'NONE') return [{ label: '', rows: pagedRows }];
    const by = new Map<string, GridRow[]>();
    for (const row of pagedRows) {
      const key =
        groupBy === 'STATUS'
          ? (row.status === 'ACTIVE' ? 'Ativos' : row.status === 'PENDING' ? 'Pendentes' : 'Inativos')
          : ROLE_LABEL[row.role];
      const prev = by.get(key) || [];
      prev.push(row);
      by.set(key, prev);
    }
    return Array.from(by.entries()).map(([label, rows]) => ({ label, rows }));
  }, [groupBy, pagedRows]);

  useEffect(() => {
    if (!error && !success) return;
    const timer = setTimeout(() => {
      setError(null);
      setSuccess(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [error, success]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, roleFilter, sortBy, sortDir, groupBy, pageSize]);

  const toggleSort = (field: 'status' | 'code' | 'name' | 'role') => {
    if (sortBy === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortBy(field);
    setSortDir('asc');
  };

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    if (tab === 'groups') {
      setActiveTab('groups');
    } else if (tab === 'members') {
      setActiveTab('members');
    }
  }, []);

  if (error === ACCESS_DENIED_MESSAGE) {
    return <AccessDeniedView area="Equipe" />;
  }

  return (
    <main className={`${styles.page} appPageShell`}>
      <header className={styles.header}>
        <SectionHeader
          title="Equipe"
          description="Usuários e permissões do escritório."
          headingAs="h1"
          className={styles.headerTitleBlock}
        />
        <BackButton fallbackHref="/dashboard" className={styles.linkMuted} />
      </header>

      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}

      <div className={styles.tabRow}>
        <button
          type="button"
          className={`${styles.tabButton} ${activeTab === 'members' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('members')}
        >
          Membros
        </button>
        <button
          type="button"
          className={`${styles.tabButton} ${activeTab === 'groups' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('groups')}
        >
          Grupos de acesso
        </button>
      </div>

      {activeTab === 'members' ? (
      <Card as="section" className={styles.card} padding="md">
        <SectionHeader
          title="Membros"
          className={styles.sectionHeadUi}
          actions={
            <div className={styles.sectionHeadRight}>
            <div className={styles.kpis}>
              <span>{grouped.active.length} ativos</span>
              <span>{pendingInvites.length} pendentes</span>
              <span>{grouped.inactive.length} inativos</span>
            </div>
            <Link href="/team/members/new" className={styles.primaryButton}>
              Inserir usuário
            </Link>
            </div>
          }
        />
        <div className={styles.gridFilters}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por código, nome, e-mail ou cargo"
            className={styles.searchInput}
          />
          <UISelect
            value={statusFilter}
            onChange={(next) => setStatusFilter(next as 'ALL' | 'ACTIVE' | 'PENDING' | 'INACTIVE')}
            className={styles.filterSelect}
            ariaLabel="Filtro por status"
            loading={loading}
            options={[
              { value: 'ALL', label: 'Todos os status' },
              { value: 'ACTIVE', label: 'Ativos' },
              { value: 'PENDING', label: 'Pendentes' },
              { value: 'INACTIVE', label: 'Inativos' },
            ]}
          />
          <UISelect
            value={roleFilter}
            onChange={(next) => setRoleFilter(next as 'ALL' | Member['role'])}
            className={styles.filterSelect}
            ariaLabel="Filtro por cargo"
            loading={loading}
            options={[
              { value: 'ALL', label: 'Todos os cargos' },
              { value: 'OWNER', label: 'Sócio' },
              { value: 'LAWYER', label: 'Advogado' },
              { value: 'ASSISTANT', label: 'Assistente' },
            ]}
          />
          <UISelect
            value={groupBy}
            onChange={(next) => setGroupBy(next as 'NONE' | 'STATUS' | 'ROLE')}
            className={styles.filterSelect}
            ariaLabel="Agrupamento"
            loading={loading}
            options={[
              { value: 'NONE', label: 'Sem agrupamento' },
              { value: 'STATUS', label: 'Agrupar por status' },
              { value: 'ROLE', label: 'Agrupar por cargo' },
            ]}
          />
        </div>
        {loading ? (
          <UIListEmpty className={styles.muted}>Carregando equipe...</UIListEmpty>
        ) : filteredGridRows.length === 0 ? (
          <UIListEmpty className={styles.muted}>Nenhum membro.</UIListEmpty>
        ) : (
          <div className={styles.table}>
            <div className={styles.gridHeader}>
              <button type="button" className={styles.sortHead} onClick={() => toggleSort('status')}>
                Status {sortBy === 'status' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </button>
              <button type="button" className={styles.sortHead} onClick={() => toggleSort('code')}>
                Código {sortBy === 'code' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </button>
              <button type="button" className={styles.sortHead} onClick={() => toggleSort('name')}>
                Usuário {sortBy === 'name' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </button>
              <button type="button" className={styles.sortHead} onClick={() => toggleSort('role')}>
                Cargo {sortBy === 'role' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </button>
              <span>Ações</span>
            </div>
            {groupedPagedRows.map((group) => (
              <div key={group.label || 'nogroup'}>
                {group.label ? <div className={styles.groupRow}>Grupo: {group.label}</div> : null}
                {group.rows.map((row) => (
                  <div key={`${row.kind}-${row.id}`} className={styles.rowGrid}>
                    <div>
                      {row.status === 'ACTIVE' ? (
                        <span className={styles.badgeStatusActive}>Ativo</span>
                      ) : row.status === 'PENDING' ? (
                        <span className={styles.pendingBadge}>Pendente</span>
                      ) : (
                        <span className={styles.badgeStatusInactive}>Inativo</span>
                      )}
                    </div>
                    <div className={styles.code}>{row.code}</div>
                    <div>
                      <div className={styles.name}>{row.name}</div>
                      <div className={styles.email}>{row.email}</div>
                      {row.kind === 'member' && row.isTemporarilyLocked ? (
                        <div className={styles.lockedHint}>Bloqueado temporariamente</div>
                      ) : null}
                      {row.kind === 'member' && row.isSelf && <div className={styles.selfHint}>Seu usuário</div>}
                      {row.kind === 'invite' ? (
                        <div className={styles.email}>
                          Expira em {new Date(row.expiresAt).toLocaleDateString('pt-BR')}
                        </div>
                      ) : null}
                    </div>
                    <div className={styles.role}>
                      <span
                        className={`${styles.roleBadge} ${roleBadgeClass(row.role)} ${
                          row.kind === 'member' && row.isSelf ? styles.roleBadgeSelf : ''
                        }`}
                      >
                        {ROLE_LABEL[row.role]}
                      </span>
                    </div>
                    <div className={styles.actions}>
                      {row.kind === 'invite' ? (
                        <ActionMenu triggerAriaLabel="Ações do convite pendente">
                          {({ close }) => (
                            <>
                              <button
                                className={styles.menuItem}
                                disabled={updating[row.id]}
                                onClick={() => {
                                  close();
                                  handleResendPendingInvite(row.id);
                                }}
                              >
                                <span className={styles.menuIcon}>✉</span>
                                Reenviar convite
                              </button>
                              <button
                                className={`${styles.menuItem} ${styles.menuDanger}`}
                                disabled={updating[row.id]}
                                onClick={() => {
                                  close();
                                  setConfirmAction({
                                    type: 'cancelInvite',
                                    id: row.id,
                                    label: `Cancelar convite de ${row.name}?`,
                                  });
                                }}
                              >
                                <span className={styles.menuIcon}>✖</span>
                                Cancelar convite
                              </button>
                            </>
                          )}
                        </ActionMenu>
                      ) : (
                        <ActionMenu triggerAriaLabel="Ações do membro">
                          {({ close }) => (
                            <>
                              <Link
                                href="#"
                                className={styles.menuItem}
                                onClick={(event) => {
                                  event.preventDefault();
                                  close();
                                  if (!canUpdateTeam) {
                                    setError(ACCESS_DENIED_MESSAGE);
                                    return;
                                  }
                                  router.push(
                                    `/team/members/${row.id}/edit?code=${encodeURIComponent(row.code)}`,
                                  );
                                }}
                              >
                                <span className={styles.menuIcon}>✎</span>
                                Alterar
                              </Link>
                              {row.status === 'ACTIVE' && !row.isSelf ? (
                                <button
                                  className={`${styles.menuItem} ${styles.menuDanger}`}
                                  disabled={updating[row.id] || !row.canDeactivate}
                                  onClick={() => {
                                    close();
                                    handleDeactivate(row.id);
                                  }}
                                >
                                  <span className={styles.menuIcon}>⛔</span>
                                  Desativar
                                </button>
                              ) : null}
                              {row.status === 'INACTIVE' ? (
                                <button
                                  className={styles.menuItem}
                                  disabled={updating[row.id]}
                                  onClick={() => {
                                    close();
                                    handleReactivate(row.id);
                                  }}
                                >
                                  <span className={styles.menuIcon}>↺</span>
                                  Reativar
                                </button>
                              ) : null}
                              {row.status === 'ACTIVE' &&
                              !row.isSelf &&
                              row.isTemporarilyLocked ? (
                                <button
                                  className={styles.menuItem}
                                  disabled={updating[row.id]}
                                  onClick={() => {
                                    close();
                                    setConfirmAction({
                                      type: 'unlock',
                                      id: row.id,
                                      label: `Desbloquear acesso de ${row.name}?`,
                                    });
                                  }}
                                >
                                  <span className={styles.menuIcon}>🔓</span>
                                  Desbloquear agora
                                </button>
                              ) : null}
                              {row.hasPendingActivation ? (
                                <button
                                  className={styles.menuItem}
                                  disabled={updating[row.id]}
                                  onClick={() => {
                                    close();
                                    handleResendActivation(row.id);
                                  }}
                                >
                                  <span className={styles.menuIcon}>✉</span>
                                  Reenviar e-mail de ativação
                                </button>
                              ) : null}
                            </>
                          )}
                        </ActionMenu>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}
            <UIListPager
              className={styles.paginationRow}
              meta={
                <>
                Exibindo {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, sortedGridRows.length)} de {sortedGridRows.length}
                </>
              }
              actions={
                <div className={styles.paginationControls}>
                <label className={styles.paginationLabel}>
                  Itens:
                  <UISelect
                    value={String(pageSize)}
                    onChange={(next) => setPageSize(Number(next))}
                    className={styles.paginationSelect}
                    ariaLabel="Itens por página"
                    loading={loading}
                    options={[
                      { value: '10', label: '10' },
                      { value: '25', label: '25' },
                      { value: '50', label: '50' },
                    ]}
                  />
                </label>
                <UIButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </UIButton>
                <UIListPagerPage>Página {currentPage} de {totalPages}</UIListPagerPage>
                <UIButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Próxima
                </UIButton>
                </div>
              }
            />
          </div>
        )}
      </Card>
      ) : (
      <Card as="section" className={styles.card} padding="md">
        <SectionHeader
          title="Grupos de acesso"
          className={styles.sectionHeadUi}
          actions={
            <div className={styles.sectionHeadRight}>
            <button
              className={styles.primaryButton}
              type="button"
              onClick={() => router.push('/team/access-groups/new')}
            >
              Inserir grupo
            </button>
            </div>
          }
        />
        {groupsLoading ? (
          <UIListEmpty className={styles.muted}>Carregando grupos...</UIListEmpty>
        ) : accessGroups.length === 0 ? (
          <UIListEmpty className={styles.muted}>Nenhum grupo de acesso.</UIListEmpty>
        ) : (
          <div className={styles.table}>
            <div className={styles.groupsGridHeader}>
              <span>Status</span>
              <span>Código</span>
              <span>Grupo</span>
              <span>Ações</span>
            </div>
            {accessGroups.map((group) => (
              <div key={group.id} className={styles.groupsRowGrid}>
                <div>
                  {group.isActive ? (
                    <span className={styles.badgeStatusActive}>Ativo</span>
                  ) : (
                    <span className={styles.badgeStatusInactive}>Inativo</span>
                  )}
                </div>
                <div className={styles.code}>{group.code}</div>
                <div>
                  <div className={styles.name}>{group.name}</div>
                  <div className={styles.email}>
                    {group.key || 'Personalizado'} {group.isSystem ? '· Padrão' : ''}
                  </div>
                </div>
                <div className={styles.actions}>
                  <ActionMenu triggerAriaLabel="Ações do grupo de acesso">
                    {({ close }) => (
                      <>
                        <button
                          className={styles.menuItem}
                          onClick={() => {
                            close();
                            router.push(`/team/access-groups/${group.id}/edit`);
                          }}
                        >
                          <span className={styles.menuIcon}>✎</span>
                          Alterar
                        </button>
                        {!group.isSystem ? (
                          <button
                            className={`${styles.menuItem} ${styles.menuDanger}`}
                            onClick={() => {
                              close();
                              handleDeleteGroup(group);
                            }}
                          >
                            <span className={styles.menuIcon}>✖</span>
                            Excluir
                          </button>
                        ) : null}
                      </>
                    )}
                  </ActionMenu>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      )}

      {confirmAction ? (
        <ConfirmDialog
          open
          title={
            confirmAction.type === 'deactivate'
              ? 'Desativar membro'
              : confirmAction.type === 'reactivate'
                ? 'Reativar membro'
                : confirmAction.type === 'unlock'
                  ? 'Desbloquear membro'
                  : confirmAction.type === 'deleteGroup'
                    ? 'Excluir grupo de acesso'
                    : 'Cancelar convite'
          }
          description={
            <>
              <div className={styles.modalSubtitle}>
                {confirmAction.type === 'deactivate'
                  ? 'Você poderá reativar este usuário depois.'
                  : confirmAction.type === 'reactivate'
                    ? 'Esta ação reativa o acesso do usuário ao escritório.'
                    : confirmAction.type === 'unlock'
                      ? 'Isto remove o bloqueio temporário por tentativas de login.'
                      : 'Essa ação é permanente e não pode ser desfeita.'}
              </div>
              <div className={styles.modalText}>{confirmAction.label}</div>
            </>
          }
          confirmLabel={
            confirmAction.type === 'deactivate'
              ? 'Desativar'
              : confirmAction.type === 'reactivate'
                ? 'Reativar'
                : confirmAction.type === 'unlock'
                  ? 'Desbloquear'
                  : confirmAction.type === 'deleteGroup'
                    ? 'Excluir grupo'
                    : 'Cancelar convite'
          }
          confirmTone={confirmAction.type === 'deleteGroup' || confirmAction.type === 'cancelInvite' ? 'danger' : 'primary'}
          onClose={() => setConfirmAction(null)}
          onConfirm={async () => {
            const action = confirmAction;
            setConfirmAction(null);
            if (action.type === 'deactivate') await handleUpdate(action.id, { isActive: false });
            if (action.type === 'reactivate') await handleUpdate(action.id, { isActive: true });
            if (action.type === 'unlock') await handleUnlock(action.id);
            if (action.type === 'cancelInvite') await handleCancelPendingInvite(action.id);
            if (action.type === 'deleteGroup') await removeGroup(action.id);
          }}
        />
      ) : null}
    </main>
  );
}
