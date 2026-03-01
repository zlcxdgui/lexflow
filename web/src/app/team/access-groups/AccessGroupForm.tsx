'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BackButton } from '@/components/BackButton';
import { extractErrorMessage } from '@/lib/errorMessage';
import { labelPermission } from '@/lib/permissionLabels';
import styles from '../team.module.css';

type Mode = 'create' | 'edit';
type Me = { tenantId: string };
type AccessGroup = {
  id: string;
  key: string | null;
  name: string;
  isSystem: boolean;
  isActive: boolean;
  permissions: string[];
};

type PermissionNode = {
  group: string;
  items?: string[];
  children?: PermissionNode[];
};

const PERMISSION_TREE: PermissionNode[] = [
  { group: 'Painel', items: ['dashboard.read'] },
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
  { group: 'Agenda', items: ['agenda.read', 'agenda.read.own', 'agenda.read.all'] },
  { group: 'Relatórios', items: ['reports.read'] },
  { group: 'Equipe', items: ['team.read', 'team.update', 'team.deactivate'] },
  { group: 'Notificações', items: ['notifications.read'] },
  { group: 'Auditoria', items: ['audit.read'] },
  { group: 'Calculadoras', items: ['calculator.read'] },
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
const PERMISSION_ROOT_LABEL = 'LexFlow';

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

export function AccessGroupForm({ mode, groupId }: { mode: Mode; groupId?: string }) {
  const router = useRouter();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [permissionSearch, setPermissionSearch] = useState('');

  const title = mode === 'create' ? 'Inserir grupo de acesso' : 'Alterar grupo de acesso';
  const subtitle =
    mode === 'create'
      ? 'Crie um novo grupo com permissões do sistema.'
      : 'Atualize nome, status e permissões do grupo.';

  const moduleItems = useMemo(
    () => collectTreeItems(PERMISSION_TREE),
    [],
  );
  const effectiveModulePermissions = useMemo(
    () => Array.from(new Set(permissions)),
    [permissions],
  );
  const isGroupChecked = (items: string[]) =>
    items.length > 0 && items.every((item) => effectiveModulePermissions.includes(item));
  const isGroupIndeterminate = (items: string[]) =>
    items.some((item) => effectiveModulePermissions.includes(item)) && !isGroupChecked(items);
  const filteredModuleTree = useMemo(() => {
    const q = permissionSearch.trim().toLowerCase();
    if (!q) return PERMISSION_TREE;
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
      if (groupMatch) {
        return node;
      }
      if (matchedItems.length === 0 && matchedChildren.length === 0) return null;
      return { ...node, items: matchedItems, children: matchedChildren };
    };
    return PERMISSION_TREE
      .map((node) => filterNode(node))
      .filter((node): node is PermissionNode => Boolean(node));
  }, [permissionSearch]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const meResp = await fetch('/api/auth/me');
        const me = (await meResp.json().catch(() => null)) as Me | null;
        if (!active) return;
        if (!meResp.ok || !me?.tenantId) throw new Error('Sessão expirada.');
        setTenantId(me.tenantId);

        if (mode === 'edit') {
          const groupsResp = await fetch(`/api/tenants/${me.tenantId}/access-groups`, {
            cache: 'no-store',
          });
          const groupsBody = await groupsResp.json().catch(() => []);
          if (!groupsResp.ok || !Array.isArray(groupsBody)) {
            throw new Error('Não foi possível carregar grupo de acesso.');
          }
          const group = (groupsBody as AccessGroup[]).find((item) => item.id === groupId);
          if (!group) throw new Error('Grupo de acesso não encontrado.');
          setName(group.name || '');
          setIsActive(Boolean(group.isActive));
          setPermissions(normalizePermissionCodes(group.permissions));
        }
      } catch (e: unknown) {
        if (!active) return;
        setError(e instanceof Error ? e.message : 'Não foi possível carregar formulário.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [groupId, mode]);

  const togglePermission = (permission: string) => {
    setPermissions((prev) =>
      prev.includes(permission) ? prev.filter((item) => item !== permission) : [...prev, permission],
    );
  };

  const toggleAllPermissions = () => {
    const hasAll = moduleItems.every((item) => effectiveModulePermissions.includes(item));
    if (hasAll) {
      setPermissions([]);
      return;
    }
    setPermissions(Array.from(new Set(moduleItems)));
  };

  const toggleModuleGroup = (items: string[]) => {
    const hasAll = items.every((item) => effectiveModulePermissions.includes(item));
    if (hasAll) {
      setPermissions((prev) => prev.filter((item) => !items.includes(item)));
      return;
    }
    setPermissions((prev) => Array.from(new Set([...prev, ...items])));
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

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantId) return;

    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        key: mode === 'create' ? null : undefined,
        isActive,
        permissions,
      };
      const url =
        mode === 'create'
          ? `/api/tenants/${tenantId}/access-groups`
          : `/api/tenants/${tenantId}/access-groups/${groupId}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';
      const resp = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const raw = await resp.text().catch(() => '');
        throw new Error(extractErrorMessage(raw, 'Não foi possível salvar grupo.', resp.status));
      }
      router.replace('/team?tab=groups');
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar grupo.');
    } finally {
      setSaving(false);
    }
  };

  const renderNode = (node: PermissionNode, keyPrefix = '') => {
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
          {ownItems.map((permission) => (
            <label key={`${nodeKey}-${permission}`} className={styles.check}>
              <input
                type="checkbox"
                checked={effectiveModulePermissions.includes(permission)}
                onChange={() => togglePermission(permission)}
              />
              <span>{labelPermission(permission)}</span>
            </label>
          ))}
          {children.map((child) => renderNode(child, `${nodeKey}-`))}
        </div>
      </details>
    );
  };

  return (
    <main className={`${styles.page} appPageShell`}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{title}</h1>
          <div className={styles.subtitle}>{subtitle}</div>
        </div>
          <BackButton fallbackHref="/team?tab=groups" className={styles.linkMuted} />
        </header>

      <section className={styles.card}>
        {loading ? <div className={styles.muted}>Carregando...</div> : null}
        {error ? <div className={styles.error}>{error}</div> : null}
        {!loading ? (
          <form className={styles.form} onSubmit={onSubmit} suppressHydrationWarning>
            <div className={styles.fieldRow}>
              <label className={styles.fieldStack}>
                Nome
                <input
                  className={styles.searchInput}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </label>
            </div>

            <label className={styles.check}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
              />
              Grupo ativo
            </label>

            <div className={styles.toolbar}>
              <input
                value={permissionSearch}
                onChange={(event) => setPermissionSearch(event.target.value)}
                placeholder="Localizar rotina..."
                className={`${styles.searchInput} ${styles.search}`}
              />
              <button type="button" className={styles.ghostButton} onClick={toggleAllPermissions}>
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
                      checked={isGroupChecked(moduleItems)}
                      indeterminate={
                        isGroupIndeterminate(moduleItems)
                      }
                      onToggle={toggleAllPermissions}
                    />
                    <span className={styles.permissionGroupTitle}>{PERMISSION_ROOT_LABEL}</span>
                  </div>
                </summary>
                <div className={styles.permissionRootBody}>
                  {filteredModuleTree.map((group) => renderNode(group))}
                </div>
              </details>
            </div>

            <div className={styles.modalActions}>
              <Link href="/team?tab=groups" className={styles.ghostButton}>
                Cancelar
              </Link>
              <button className={styles.primaryButton} type="submit" disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
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
