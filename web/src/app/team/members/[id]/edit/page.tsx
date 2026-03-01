'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { BackButton } from '@/components/BackButton';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { UISelect } from '@/components/ui/Select';
import { labelPermission } from '@/lib/permissionLabels';
import styles from './edit.module.css';

type Me = {
  tenantId: string;
  role?: 'ADMIN' | 'OWNER' | 'LAWYER' | 'ASSISTANT';
  isAdmin?: boolean;
};
type Person = {
  id: string;
  code?: number | null;
  name: string;
  cpf?: string | null;
  email: string | null;
  relacoesComerciais?: Array<'CLIENTE' | 'FUNCIONARIO'>;
};
type MemberRole = 'OWNER' | 'LAWYER' | 'ASSISTANT';
type AccessGroup = {
  id: string;
  key: string | null;
  name: string;
  isActive: boolean;
  permissions: string[];
};
type MemberSettings = {
  supervisor?: boolean;
  receivesReleaseCenterNotifications?: boolean;
  blockAccessAfter?: string | null;
  passwordRotateDays?: number | null;
  language?: string;
  timezone?: string;
  modulePermissions?: string[];
  groupPermissions?: string[];
  accessScheduleEnabled?: boolean;
  accessSchedule?: Array<{ day: number; start: string; end: string }>;
};
type MemberDetails = {
  id: string;
  role: string;
  isActive: boolean;
  employeeClientId?: string | null;
  user: { id: string; name: string; email: string };
  canEditEmail: boolean;
  settings?: MemberSettings;
  tenantTimezone?: string;
};
type PermissionNode = {
  group: string;
  items?: string[];
  children?: PermissionNode[];
};

type ApiBody = {
  message?: string | string[];
  detail?: string;
};

const MODULE_TREE: PermissionNode[] = [
  {
    group: 'Painel',
    items: ['dashboard.read'],
  },
  {
    group: 'Casos',
    items: ['matter.read', 'matter.create', 'matter.edit', 'matter.delete'],
    children: [
      { group: 'Tarefas', items: ['task.read', 'task.create', 'task.edit', 'task.delete'] },
      {
        group: 'Prazos',
        items: ['deadline.read', 'deadline.create', 'deadline.edit', 'deadline.delete'],
      },
      {
        group: 'Documentos',
        items: ['document.read', 'document.upload', 'document.edit', 'document.delete'],
      },
    ],
  },
  {
    group: 'Pessoas',
    items: ['client.read', 'client.create', 'client.edit', 'client.delete'],
  },
  {
    group: 'Atendimento',
    items: [
      'appointment.read',
      'appointment.create',
      'appointment.edit',
      'appointment.delete',
    ],
  },
  {
    group: 'Agenda',
    items: ['agenda.read', 'agenda.read.own', 'agenda.read.all'],
  },
  {
    group: 'Relatórios',
    items: ['reports.read'],
  },
  {
    group: 'Equipe',
    items: ['team.read', 'team.update', 'team.deactivate'],
  },
  {
    group: 'Notificações',
    items: ['notifications.read'],
  },
  {
    group: 'Auditoria',
    items: ['audit.read'],
  },
  {
    group: 'Calculadoras',
    items: ['calculator.read'],
  },
  {
    group: 'Financeiro',
    items: [
      'finance.read',
      'finance.create',
      'finance.edit',
      'finance.settle',
      'finance.cancel',
      'finance.catalog.read',
      'finance.catalog.manage',
      'finance.recurrence.manage',
    ],
  },
];

function collectNodeItems(node: PermissionNode): string[] {
  const own = Array.isArray(node.items) ? node.items : [];
  const fromChildren = Array.isArray(node.children)
    ? node.children.flatMap((child) => collectNodeItems(child))
    : [];
  return [...own, ...fromChildren];
}

function collectTreeItems(tree: PermissionNode[]): string[] {
  return tree.flatMap((node) => collectNodeItems(node));
}

function normalizePermissionCodes(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const normalized = input.map((raw) => {
    const value = String(raw || '').trim();
    if (value === 'team.manage') return 'team.update';
    return value;
  });
  return Array.from(new Set(normalized.filter(Boolean)));
}

const DEFAULT_GROUP_PERMISSION_MAP: Record<string, string[]> = {
  OWNER: collectTreeItems(MODULE_TREE),
  LAWYER: [
    'dashboard.read',
    'notifications.read',
    'client.read',
    'client.create',
    'client.edit',
    'matter.read',
    'matter.create',
    'matter.edit',
    'task.read',
    'task.create',
    'task.edit',
    'deadline.read',
    'deadline.create',
    'deadline.edit',
    'document.read',
    'document.upload',
    'document.edit',
    'agenda.read',
    'agenda.read.all',
    'appointment.read',
    'appointment.create',
    'appointment.edit',
    'calculator.read',
    'finance.read',
    'finance.create',
    'finance.edit',
    'finance.settle',
    'finance.cancel',
    'finance.catalog.read',
    'finance.catalog.manage',
    'finance.recurrence.manage',
    'reports.read',
    'audit.read',
    'team.read',
  ],
  ASSISTANT: [
    'dashboard.read',
    'notifications.read',
    'client.read',
    'client.create',
    'client.edit',
    'matter.read',
    'matter.create',
    'matter.edit',
    'task.read',
    'task.create',
    'task.edit',
    'deadline.read',
    'deadline.create',
    'deadline.edit',
    'document.read',
    'document.upload',
    'document.edit',
    'agenda.read',
    'agenda.read.own',
    'appointment.read',
    'appointment.create',
    'appointment.edit',
    'calculator.read',
    'finance.read',
    'finance.create',
    'finance.edit',
    'finance.settle',
    'finance.cancel',
    'finance.catalog.read',
    'reports.read',
    'audit.read',
    'team.read',
  ],
};
const GROUP_KEYS: MemberRole[] = ['OWNER', 'LAWYER', 'ASSISTANT'];
const DEFAULT_GROUP_LABELS: Record<MemberRole, string> = {
  OWNER: 'Sócio',
  LAWYER: 'Advogado',
  ASSISTANT: 'Assistente',
};
type GroupOption = { value: string; label: string };
const PERMISSION_ROOT_LABEL = 'LexFlow';

const WEEK_DAYS = [
  { day: 1, label: 'Segunda' },
  { day: 2, label: 'Terça' },
  { day: 3, label: 'Quarta' },
  { day: 4, label: 'Quinta' },
  { day: 5, label: 'Sexta' },
  { day: 6, label: 'Sábado' },
  { day: 0, label: 'Domingo' },
];

const DEFAULT_SCHEDULE: Record<number, { start: string; end: string }> = {
  0: { start: '08:00', end: '18:00' },
  1: { start: '08:00', end: '18:00' },
  2: { start: '08:00', end: '18:00' },
  3: { start: '08:00', end: '18:00' },
  4: { start: '08:00', end: '18:00' },
  5: { start: '08:00', end: '18:00' },
  6: { start: '08:00', end: '12:00' },
};

function extractMessageFromBody(body: ApiBody | null, fallback: string) {
  if (Array.isArray(body?.message)) return body.message[0] || fallback;
  if (typeof body?.message === 'string') return body.message;
  if (typeof body?.detail === 'string') return body.detail;
  return fallback;
}

export default function EditTeamMemberPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const memberId = params?.id;
  const rowCode = searchParams.get('code')?.trim();

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [member, setMember] = useState<MemberDetails | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [canAssignOwner, setCanAssignOwner] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [personQuery, setPersonQuery] = useState('');
  const [selectedEmployeeClientId, setSelectedEmployeeClientId] = useState('');
  const [personOpen, setPersonOpen] = useState(false);

  const [supervisor, setSupervisor] = useState(false);
  const [releaseNotifications, setReleaseNotifications] = useState(false);
  const [blockAccessAfter, setBlockAccessAfter] = useState('');
  const [passwordRotateDays, setPasswordRotateDays] = useState('0');
  const [language, setLanguage] = useState('pt-BR');
  const [timezone, setTimezone] = useState('America/Manaus');
  const [modulePermissions, setModulePermissions] = useState<string[]>([]);
  const [groupPermissions, setGroupPermissions] = useState<string[]>([]);
  const [groupPermissionMap, setGroupPermissionMap] = useState<Record<string, string[]>>(
    DEFAULT_GROUP_PERMISSION_MAP,
  );
  const [groupOptions, setGroupOptions] = useState<GroupOption[]>(
    GROUP_KEYS.map((value) => ({
      value,
      label: DEFAULT_GROUP_LABELS[value],
    })),
  );
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [schedule, setSchedule] = useState<Record<number, { start: string; end: string }>>(
    DEFAULT_SCHEDULE,
  );
  const [permissionSearch, setPermissionSearch] = useState('');
  const formErrorId = 'team-member-edit-form-error';
  const errorText = (error || '').toLowerCase();
  const employeeFieldInvalid = errorText.includes('funcionário válido');

  const loadAccessGroups = useCallback(async (currentTenantId: string) => {
    const groupsResp = await fetch(`/api/tenants/${currentTenantId}/access-groups`, {
      cache: 'no-store',
    });
    const groupsBody = await groupsResp.json().catch(() => []);
    if (!groupsResp.ok || !Array.isArray(groupsBody)) return;

    const nextMap: Record<string, string[]> = {};
    const nextOptions: GroupOption[] = [];
    for (const item of groupsBody as AccessGroup[]) {
      if (!item?.isActive) continue;
      const key = String(item.key || '').toUpperCase();
      const value = GROUP_KEYS.includes(key as MemberRole)
        ? key
        : `GROUP:${item.id}`;
      nextMap[value] = normalizePermissionCodes(item.permissions);
      nextOptions.push({
        value,
        label: item.name || (GROUP_KEYS.includes(key as MemberRole) ? DEFAULT_GROUP_LABELS[key as MemberRole] : 'Grupo'),
      });
    }
    if (!nextOptions.length) {
      for (const role of GROUP_KEYS) {
        nextMap[role] = DEFAULT_GROUP_PERMISSION_MAP[role];
        nextOptions.push({ value: role, label: DEFAULT_GROUP_LABELS[role] });
      }
    }
    setGroupPermissionMap(nextMap);
    setGroupOptions(nextOptions);
  }, []);

  const moduleItems = useMemo(() => collectTreeItems(MODULE_TREE), []);
  const inheritedPermissions = useMemo(() => {
    return groupPermissions.reduce<string[]>((acc, group) => {
      const inherited = groupPermissionMap[group] || [];
      return [...acc, ...inherited];
    }, []);
  }, [groupPermissions, groupPermissionMap]);
  const inheritedPermissionsSet = useMemo(
    () => new Set(inheritedPermissions),
    [inheritedPermissions],
  );
  const effectiveModulePermissions = useMemo(() => {
    return Array.from(new Set([...modulePermissions, ...inheritedPermissions]));
  }, [modulePermissions, inheritedPermissions]);
  const onlyDigits = (value?: string | null) => (value || '').replace(/\D+/g, '');
  const formatCpf = (value?: string | null) => {
    const d = onlyDigits(value).slice(0, 11);
    if (!d) return '-';
    return d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  };
  const personLabel = (person: Person) =>
    `${person.code ?? '-'} - ${person.name.toUpperCase()} (${formatCpf(person.cpf)})`;

  const funcionarios = useMemo(
    () => people.filter((person) => (person.relacoesComerciais || []).includes('FUNCIONARIO')),
    [people],
  );

  const personSuggestions = useMemo(() => {
    const q = personQuery.trim().toLowerCase();
    if (!q) return funcionarios;
    return funcionarios.filter((person) => {
      const haystack = `${person.code ?? ''} ${person.name} ${person.cpf || ''} ${person.email || ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [funcionarios, personQuery]);

  useEffect(() => {
    if (!selectedEmployeeClientId) {
      setPersonQuery('');
      return;
    }
    if (!funcionarios.length) return;
    const selected = funcionarios.find((person) => person.id === selectedEmployeeClientId);
    if (!selected) return;
    const id = selected.code ?? '-';
    const cpfDigits = (selected.cpf || '').replace(/\D+/g, '').slice(0, 11);
    const cpfFormatted = cpfDigits
      ? cpfDigits
          .replace(/(\d{3})(\d)/, '$1.$2')
          .replace(/(\d{3})(\d)/, '$1.$2')
          .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
      : '-';
    setPersonQuery(`${id} - ${selected.name.toUpperCase()} (${cpfFormatted})`);
  }, [funcionarios, selectedEmployeeClientId]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const meResp = await fetch('/api/auth/me');
        const me = (await meResp.json().catch(() => null)) as Me | null;
        if (!active) return;
        if (!meResp.ok || !me?.tenantId) throw new Error('Sessão expirada.');
        setTenantId(me.tenantId);
        setCanAssignOwner(me.role === 'ADMIN' || Boolean(me.isAdmin));
        await loadAccessGroups(me.tenantId);

        if (!memberId) throw new Error('Membro inválido.');
        const memberResp = await fetch(`/api/tenants/${me.tenantId}/members/${memberId}`);
        const memberBody = await memberResp.json().catch(() => null);
        if (!memberResp.ok) {
          throw new Error(extractMessageFromBody(memberBody, 'Não foi possível carregar membro.'));
        }

        setMember(memberBody);
        setName(memberBody.user?.name || '');
        setEmail(memberBody.user?.email || '');
        setSelectedEmployeeClientId(memberBody.employeeClientId || '');
        setPersonQuery('');
        const settings = (memberBody.settings || {}) as MemberSettings;
        setSupervisor(Boolean(settings.supervisor));
        setReleaseNotifications(Boolean(settings.receivesReleaseCenterNotifications));
        setBlockAccessAfter(settings.blockAccessAfter || '');
        setPasswordRotateDays(String(settings.passwordRotateDays ?? 0));
        setLanguage(settings.language || 'pt-BR');
        const normalizedTimezone = String(
          settings.timezone || memberBody.tenantTimezone || 'America/Manaus',
        );
        setTimezone(normalizedTimezone);
        setModulePermissions(normalizePermissionCodes(settings.modulePermissions));

        const persistedGroups = Array.isArray(settings.groupPermissions)
          ? settings.groupPermissions.map((g) => String(g))
          : [];
        if (persistedGroups.length > 0) {
          setGroupPermissions(persistedGroups);
        } else if (
          memberBody.role === 'OWNER' ||
          memberBody.role === 'LAWYER' ||
          memberBody.role === 'ASSISTANT'
        ) {
          setGroupPermissions([memberBody.role]);
        } else {
          setGroupPermissions([]);
        }
        setScheduleEnabled(Boolean(settings.accessScheduleEnabled));
        if (Array.isArray(settings.accessSchedule) && settings.accessSchedule.length > 0) {
          const next = { ...DEFAULT_SCHEDULE };
          settings.accessSchedule.forEach((row) => {
            next[row.day] = { start: row.start, end: row.end };
          });
          setSchedule(next);
        }

        const peopleResp = await fetch('/api/clients', { cache: 'no-store' });
        const peopleBody = await peopleResp.json().catch(() => []);
        if (!active) return;
        setPeople(peopleResp.ok && Array.isArray(peopleBody) ? peopleBody : []);
      } catch (e: unknown) {
        if (!active) return;
        setError(e instanceof Error ? e.message : 'Não foi possível carregar membro.');
      } finally {
        if (!active) return;
        setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [memberId, loadAccessGroups]);

  useEffect(() => {
    if (!tenantId) return;
    const refreshOnFocus = () => {
      if (document.visibilityState !== 'visible') return;
      void loadAccessGroups(tenantId);
    };
    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', refreshOnFocus);
    return () => {
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener('visibilitychange', refreshOnFocus);
    };
  }, [tenantId, loadAccessGroups]);

  useEffect(() => {
    if (!groupOptions.length) return;
    const selected = groupPermissions[0];
    if (selected && groupOptions.some((option) => option.value === selected)) return;
    if (
      member?.role &&
      groupOptions.some((option) => option.value === member.role)
    ) {
      setGroupPermissions([member.role]);
      return;
    }
    setGroupPermissions([groupOptions[0].value]);
  }, [groupOptions, groupPermissions, member?.role]);

  useEffect(() => {
    if (!personOpen) return;
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-person-picker="true"]')) return;
      setPersonOpen(false);
    };
    document.addEventListener('click', handleOutside);
    return () => document.removeEventListener('click', handleOutside);
  }, [personOpen]);

  const filteredModuleTree = useMemo(() => {
    const q = permissionSearch.trim().toLowerCase();
    if (!q) return MODULE_TREE;
    const filterNode = (node: PermissionNode): PermissionNode | null => {
      const groupMatch = node.group.toLowerCase().includes(q);
      const ownItems = Array.isArray(node.items) ? node.items : [];
      const matchedItems = groupMatch
        ? ownItems
        : ownItems.filter(
            (item) =>
              item.toLowerCase().includes(q) ||
              labelPermission(item).toLowerCase().includes(q),
          );
      const matchedChildren = Array.isArray(node.children)
        ? node.children
            .map((child) => filterNode(child))
            .filter((child): child is PermissionNode => Boolean(child))
        : [];
      if (groupMatch) return node;
      if (matchedItems.length === 0 && matchedChildren.length === 0) return null;
      return { ...node, items: matchedItems, children: matchedChildren };
    };
    return MODULE_TREE
      .map((node) => filterNode(node))
      .filter((node): node is PermissionNode => Boolean(node));
  }, [permissionSearch]);

  const selectedRole = useMemo<MemberRole>(() => {
    const first = groupPermissions[0];
    if (first === 'OWNER' || first === 'LAWYER' || first === 'ASSISTANT') return first;
    if (member?.role === 'OWNER' || member?.role === 'LAWYER' || member?.role === 'ASSISTANT') {
      return member.role;
    }
    return 'LAWYER';
  }, [groupPermissions, member?.role]);

  const toggleModule = (perm: string) => {
    if (inheritedPermissionsSet.has(perm)) return;
    setModulePermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
    );
  };

  const toggleGroup = (group: string) => {
    setGroupPermissions((prev) => (prev[0] === group ? [] : [group]));
  };

  const selectFuncionario = (person: Person) => {
    setPersonQuery(personLabel(person));
    setSelectedEmployeeClientId(person.id);
    setPersonOpen(false);
    setError(null);
    setName(person.name || '');
  };

  const toggleAllModules = () => {
    const manualEligible = moduleItems.filter((item) => !inheritedPermissionsSet.has(item));
    const hasAllManualEligible = manualEligible.every((item) => modulePermissions.includes(item));
    if (hasAllManualEligible) {
      setModulePermissions((prev) => prev.filter((item) => inheritedPermissionsSet.has(item)));
      return;
    }
    setModulePermissions((prev) => Array.from(new Set([...prev, ...manualEligible])));
  };

  const toggleModuleGroup = (items: string[]) => {
    const eligible = items.filter((item) => !inheritedPermissionsSet.has(item));
    const hasAllEligible = eligible.every((item) => modulePermissions.includes(item));
    if (hasAllEligible) {
      setModulePermissions((prev) => prev.filter((item) => !eligible.includes(item)));
      return;
    }
    setModulePermissions((prev) => Array.from(new Set([...prev, ...eligible])));
  };

  const isNodeChecked = (node: PermissionNode) => {
    const items = collectNodeItems(node);
    return items.length > 0 && items.every((item) => effectiveModulePermissions.includes(item));
  };

  const isNodeIndeterminate = (node: PermissionNode) => {
    const items = collectNodeItems(node);
    return (
      items.some((item) => effectiveModulePermissions.includes(item)) &&
      !items.every((item) => effectiveModulePermissions.includes(item))
    );
  };

  const renderPermissionNode = (node: PermissionNode, keyPrefix = '') => {
    const nodeKey = `${keyPrefix}${node.group}`;
    const ownItems = Array.isArray(node.items) ? node.items : [];
    const children = Array.isArray(node.children) ? node.children : [];
    return (
      <details
        key={nodeKey}
        className={styles.permissionSubGroup}
        open={Boolean(permissionSearch.trim())}
      >
        <summary className={styles.permissionGroupSummary}>
          <div className={styles.check}>
            <TreeCheckbox
              checked={isNodeChecked(node)}
              indeterminate={isNodeIndeterminate(node)}
              onToggle={() => toggleModuleGroup(collectNodeItems(node))}
            />
            <span className={styles.permissionGroupTitle}>{node.group}</span>
          </div>
        </summary>

        <div className={styles.permissionItems}>
          {ownItems.map((item) => (
            <label
              key={`${nodeKey}-${item}`}
              className={`${styles.check} ${inheritedPermissionsSet.has(item) ? styles.inheritedOption : ''}`}
            >
              <input
                type="checkbox"
                checked={effectiveModulePermissions.includes(item)}
                disabled={inheritedPermissionsSet.has(item)}
                onChange={() => toggleModule(item)}
              />
              <span className={styles.permissionText}>
                <span>{labelPermission(item)}</span>
              </span>
            </label>
          ))}
          {children.map((child) => renderPermissionNode(child, `${nodeKey}-`))}
        </div>
      </details>
    );
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !memberId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (!selectedEmployeeClientId) {
        throw new Error('Selecione um funcionário válido.');
      }
      if (!selectedRole) {
        throw new Error('Selecione um grupo/cargo para o usuário.');
      }

      const profileResp = await fetch(`/api/tenants/${tenantId}/members/${memberId}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, employeeClientId: selectedEmployeeClientId }),
      });
      const profileBody = await profileResp.json().catch(() => null);
      if (!profileResp.ok) {
        throw new Error(extractMessageFromBody(profileBody, 'Não foi possível salvar perfil.'));
      }

      if (member?.role !== selectedRole) {
        const memberResp = await fetch(`/api/tenants/${tenantId}/members/${memberId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: selectedRole }),
        });
        const memberBody = await memberResp.json().catch(() => null);
        if (!memberResp.ok) {
          throw new Error(extractMessageFromBody(memberBody, 'Não foi possível atualizar cargo.'));
        }
      }

      const accessSchedule = WEEK_DAYS.map((w) => ({
        day: w.day,
        start: schedule[w.day].start,
        end: schedule[w.day].end,
      }));

      const settingsResp = await fetch(`/api/tenants/${tenantId}/members/${memberId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supervisor,
          receivesReleaseCenterNotifications: releaseNotifications,
          blockAccessAfter: blockAccessAfter || null,
          passwordRotateDays: Number(passwordRotateDays || 0),
          language,
          timezone,
          modulePermissions,
          groupPermissions,
          accessScheduleEnabled: scheduleEnabled,
          accessSchedule,
        }),
      });
      const settingsBody = await settingsResp.json().catch(() => null);
      if (!settingsResp.ok) {
        throw new Error(extractMessageFromBody(settingsBody, 'Não foi possível salvar configurações.'));
      }

      setSuccess('Usuário atualizado com sucesso.');
      setTimeout(() => {
        router.replace('/team');
        router.refresh();
      }, 700);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar alterações.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className={`${styles.page} appPageShell`}>
      <SectionHeader
        title="Alterar usuário"
        description="Dados do acesso, permissões e horário."
        headingAs="h1"
        className={styles.header}
        actions={<BackButton fallbackHref="/team" className={styles.linkMuted} />}
      />

      <section className={styles.card}>
        {loading ? <div className={styles.muted}>Carregando...</div> : null}
        {error ? <div id={formErrorId} className={styles.error}>{error}</div> : null}
        {success ? <div className={styles.success}>{success}</div> : null}

        {!loading && member ? (
          <form className={styles.form} onSubmit={onSubmit} suppressHydrationWarning>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Dados do acesso</h2>
              <div className={styles.grid2}>
                <label className={styles.field}>
                  <span>Código</span>
                  <input value={rowCode || member.id.slice(0, 8).toUpperCase()} disabled />
                </label>
                <div className={styles.gridSpacer} aria-hidden="true" />
                <label className={styles.field}>
                  <span>E-mail</span>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled
                    className={styles.lockedInput}
                    title="Campo bloqueado"
                    required
                  />
                </label>
                <label className={styles.field}>
                  <span>Funcionário</span>
                  <div className={styles.personWrap} data-person-picker="true">
                    <input
                      type="text"
                      value={personQuery}
                      onChange={(event) => {
                        setPersonQuery(event.target.value);
                        setSelectedEmployeeClientId('');
                        setPersonOpen(true);
                      }}
                      onFocus={() => setPersonOpen(true)}
                      placeholder="Buscar por ID, nome ou CPF"
                      aria-invalid={employeeFieldInvalid || undefined}
                      aria-describedby={error ? formErrorId : undefined}
                    />
                    {personOpen && personSuggestions.length > 0 ? (
                      <div className={styles.personDropdown}>
                        {personSuggestions.map((person) => (
                          <button
                            key={person.id}
                            type="button"
                            className={styles.personOption}
                            onMouseDown={(ev) => {
                              ev.preventDefault();
                              selectFuncionario(person);
                            }}
                          >
                            <span>{personLabel(person)}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </label>
              </div>
              <div className={styles.grid4}>
                <label className={styles.field}>
                  <span>Impedir acesso após</span>
                  <input
                    type="date"
                    value={blockAccessAfter}
                    onChange={(e) => setBlockAccessAfter(e.target.value)}
                  />
                </label>
                <label className={styles.field}>
                  <span>Trocar senha a cada (dias)</span>
                  <input
                    type="number"
                    min={0}
                    value={passwordRotateDays}
                    onChange={(e) => setPasswordRotateDays(e.target.value)}
                  />
                </label>
                  <label className={styles.field}>
                    <span>Idioma</span>
                    <UISelect
                      value={language}
                      onChange={setLanguage}
                      ariaLabel="Idioma"
                      ariaDescribedBy={error ? formErrorId : undefined}
                      options={[
                        { value: 'pt-BR', label: 'Português (Brasil)' },
                        { value: 'en-US', label: 'English (US)' },
                        { value: 'es-AR', label: 'Español' },
                      ]}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Fuso horário</span>
                    <UISelect
                      value={timezone}
                      onChange={setTimezone}
                      ariaLabel="Fuso horário"
                      ariaDescribedBy={error ? formErrorId : undefined}
                      options={[
                        { value: 'America/Sao_Paulo', label: '(UTC-03:00) Brasília' },
                        { value: 'America/Manaus', label: '(UTC-04:00) Manaus' },
                      ]}
                    />
                  </label>
              </div>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Permissões de acesso</h2>
              <div className={styles.hint}>
                As permissões herdadas do grupo ficam marcadas automaticamente e não podem ser desmarcadas manualmente.
              </div>
              <div className={styles.toolbar}>
                <input
                  value={permissionSearch}
                  onChange={(e) => setPermissionSearch(e.target.value)}
                  placeholder="Localizar rotina..."
                  className={styles.search}
                />
                <button type="button" className={styles.ghostButton} onClick={toggleAllModules}>
                  {moduleItems.every((item) => effectiveModulePermissions.includes(item))
                    ? 'Desmarcar tudo'
                    : 'Marcar tudo'}
                </button>
              </div>
              <div className={styles.permissionTree}>
                <details className={styles.permissionGroup} open>
                  <summary className={styles.permissionGroupSummary}>
                    <div className={styles.check}>
                      <TreeCheckbox
                        checked={moduleItems.every((item) => effectiveModulePermissions.includes(item))}
                        indeterminate={
                          moduleItems.some((item) => effectiveModulePermissions.includes(item)) &&
                          !moduleItems.every((item) => effectiveModulePermissions.includes(item))
                        }
                        onToggle={toggleAllModules}
                      />
                      <span className={styles.permissionGroupTitle}>{PERMISSION_ROOT_LABEL}</span>
                    </div>
                  </summary>

                  <div className={styles.permissionRootBody}>
                    {filteredModuleTree.map((group) => renderPermissionNode(group))}
                  </div>
                </details>
                {inheritedPermissions.length > 0 ? (
                  <div className={styles.inheritedNote}>
                    <strong className={styles.inheritedNoteTitle}>Permissões herdadas</strong>
                    <span className={styles.inheritedNoteText}>
                      Herdado de algum grupo, não pode ser alterado.
                    </span>
                  </div>
                ) : null}
              </div>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Permissões de grupos</h2>
              <div className={styles.groupGrid}>
                {groupOptions.filter((group) => canAssignOwner || group.value !== 'OWNER').map((group) => (
                  <label
                    key={group.value}
                    className={`${styles.groupOption} ${groupPermissions.includes(group.value) ? styles.groupOptionActive : ''}`}
                  >
                    <input
                      type="radio"
                      name="groupRole"
                      checked={groupPermissions.includes(group.value)}
                      onChange={() => toggleGroup(group.value)}
                      aria-describedby={error ? formErrorId : undefined}
                    />
                    <span className={styles.groupOptionText}>
                      <span className={styles.groupOptionTitle}>{group.label}</span>
                      <span className={styles.groupOptionMeta}>
                        {group.value.startsWith('GROUP:') ? 'Grupo personalizado' : 'Grupo padrão'}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Horário de acesso</h2>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={scheduleEnabled}
                  onChange={(e) => setScheduleEnabled(e.target.checked)}
                />
                Controlar horário de acesso desse usuário
              </label>
              <div className={styles.scheduleTable}>
                <div className={styles.scheduleHead}>Dia</div>
                <div className={styles.scheduleHead}>Início</div>
                <div className={styles.scheduleHead}>Fim</div>
                {WEEK_DAYS.map((w) => (
                  <div key={w.day} className={styles.scheduleRow}>
                    <div>{w.label}</div>
                    <input
                      type="time"
                      value={schedule[w.day].start}
                      disabled={!scheduleEnabled}
                      onChange={(e) =>
                        setSchedule((prev) => ({
                          ...prev,
                          [w.day]: { ...prev[w.day], start: e.target.value },
                        }))
                      }
                    />
                    <input
                      type="time"
                      value={schedule[w.day].end}
                      disabled={!scheduleEnabled}
                      onChange={(e) =>
                        setSchedule((prev) => ({
                          ...prev,
                          [w.day]: { ...prev[w.day], end: e.target.value },
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            </section>

            <div className={styles.actions}>
              <button className={styles.primaryButton} type="submit" disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar alterações'}
              </button>
              <Link href="/team" className={styles.ghostButton}>
                Cancelar
              </Link>
            </div>
          </form>
        ) : null}
      </section>
    </main>
  );
}

function TreeCheckbox({
  checked,
  indeterminate,
  onToggle,
}: {
  checked: boolean;
  indeterminate: boolean;
  onToggle?: () => void;
}) {
  const ref = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      aria-checked={indeterminate ? 'mixed' : checked}
      onChange={() => onToggle?.()}
      onClick={(event) => event.stopPropagation()}
      readOnly={!onToggle}
    />
  );
}
