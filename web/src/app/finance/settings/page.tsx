'use client';

import { useEffect, useState } from 'react';
import { BackButton } from '@/components/BackButton';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { UISelect } from '@/components/ui/Select';
import styles from '../finance.module.css';

type Item = { id: string; name: string; type?: string; kind?: string; isActive?: boolean };
type CatalogKind = 'account' | 'category' | 'cost-center';

function ActiveSelect({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <UISelect
      className={styles.filterSelect}
      value={value ? '1' : '0'}
      onChange={(next) => onChange(next === '1')}
      ariaLabel="Status"
      options={[
        { value: '1', label: 'Ativo' },
        { value: '0', label: 'Inativo' },
      ]}
    />
  );
}

function CatalogInlineRow({
  item,
  kind,
  onReload,
  onError,
}: {
  item: Item;
  kind: CatalogKind;
  onReload: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(item.name || '');
  const [type, setType] = useState(item.type || 'BANK');
  const [categoryKind, setCategoryKind] = useState(item.kind || 'BOTH');
  const [isActive, setIsActive] = useState(item.isActive !== false);

  useEffect(() => {
    setName(item.name || '');
    setType(item.type || 'BANK');
    setCategoryKind(item.kind || 'BOTH');
    setIsActive(item.isActive !== false);
  }, [item]);

  const patchPath =
    kind === 'account'
      ? `/api/finance/accounts/${item.id}`
      : kind === 'category'
        ? `/api/finance/categories/${item.id}`
        : `/api/finance/cost-centers/${item.id}`;

  async function save() {
    if (saving) return;
    setSaving(true);
    onError('');
    try {
      const body: Record<string, unknown> = { name, isActive };
      if (kind === 'account') body.type = type;
      if (kind === 'category') body.kind = categoryKind;
      const resp = await fetch(patchPath, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!resp.ok) throw new Error(await resp.text().catch(() => 'Erro ao salvar'));
      setEditing(false);
      await onReload();
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.catalogRow}>
      <div className={styles.catalogRowTop}>
        <div>
          <div className={styles.catalogName}>{item.name}</div>
          <div className={styles.catalogMeta}>
            {kind === 'account' ? (item.type || '-') : kind === 'category' ? (item.kind || '-') : 'Centro de custo'} ·{' '}
            {item.isActive === false ? 'Inativo' : 'Ativo'}
          </div>
        </div>
        <div className={styles.rowActions}>
          {!editing ? (
            <button type="button" className={styles.smallBtn} onClick={() => setEditing(true)}>
              Editar
            </button>
          ) : (
            <>
              <button type="button" className={styles.smallBtn} disabled={saving || !name.trim()} onClick={save}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
              <button
                type="button"
                className={styles.smallBtn}
                disabled={saving}
                onClick={() => {
                  setEditing(false);
                  setName(item.name || '');
                  setType(item.type || 'BANK');
                  setCategoryKind(item.kind || 'BOTH');
                  setIsActive(item.isActive !== false);
                }}
              >
                Cancelar
              </button>
            </>
          )}
        </div>
      </div>

      {editing ? (
        <div className={kind === 'cost-center' ? styles.catalogEditGridCompact : styles.catalogEditGrid}>
          <label className={styles.label}>
            <span>Nome</span>
            <input className={styles.filterInput} value={name} onChange={(e) => setName(e.target.value)} />
          </label>

          {kind === 'account' ? (
            <label className={styles.label}>
              <span>Tipo</span>
              <UISelect
                className={styles.filterSelect}
                value={type}
                onChange={setType}
                ariaLabel="Tipo da conta"
                options={[
                  { value: 'BANK', label: 'Banco' },
                  { value: 'CASH', label: 'Caixa' },
                  { value: 'DIGITAL', label: 'Digital' },
                ]}
              />
            </label>
          ) : null}

          {kind === 'category' ? (
            <label className={styles.label}>
              <span>Uso</span>
              <UISelect
                className={styles.filterSelect}
                value={categoryKind}
                onChange={setCategoryKind}
                ariaLabel="Tipo da categoria"
                options={[
                  { value: 'BOTH', label: 'Receber e pagar' },
                  { value: 'RECEIVABLE', label: 'Apenas receber' },
                  { value: 'PAYABLE', label: 'Apenas pagar' },
                ]}
              />
            </label>
          ) : null}

          <label className={styles.label}>
            <span>Status</span>
            <ActiveSelect value={isActive} onChange={setIsActive} />
          </label>
        </div>
      ) : null}
    </div>
  );
}

function CatalogSection({
  title,
  subtitle,
  items,
  kind,
  loading,
  onReload,
  onError,
}: {
  title: string;
  subtitle: string;
  items: Item[];
  kind: CatalogKind;
  loading: boolean;
  onReload: () => Promise<void>;
  onError: (message: string) => void;
}) {
  return (
    <section className={styles.catalogSection}>
      <div className={styles.catalogHeader}>
        <div>
          <div className={styles.kpiLabel}>{title}</div>
          <div className={styles.metaMuted}>{loading ? 'Carregando...' : `${items.length} cadastrada(s)`}</div>
        </div>
        <div className={styles.metaMuted}>{subtitle}</div>
      </div>
      {items.length ? (
        <div className={styles.catalogList}>
          {items.map((item) => (
            <CatalogInlineRow key={item.id} item={item} kind={kind} onReload={onReload} onError={onError} />
          ))}
        </div>
      ) : (
        <div className={styles.metaMuted}>Nenhum item cadastrado.</div>
      )}
    </section>
  );
}

export default function FinanceSettingsPage() {
  const [accounts, setAccounts] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Item[]>([]);
  const [costCenters, setCostCenters] = useState<Item[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState('BANK');
  const [categoryName, setCategoryName] = useState('');
  const [categoryKind, setCategoryKind] = useState('BOTH');
  const [costCenterName, setCostCenterName] = useState('');

  async function loadAll() {
    setLoading(true);
    setError('');
    try {
      const [a, c, cc] = await Promise.all([
        fetch('/api/finance/accounts', { cache: 'no-store' }),
        fetch('/api/finance/categories', { cache: 'no-store' }),
        fetch('/api/finance/cost-centers', { cache: 'no-store' }),
      ]);
      setAccounts((await a.json().catch(() => [])) || []);
      setCategories((await c.json().catch(() => [])) || []);
      setCostCenters((await cc.json().catch(() => [])) || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function createCatalog(path: string, body: object, after: () => void) {
    setError('');
    const resp = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error(await resp.text().catch(() => 'Erro ao salvar'));
    after();
    await loadAll();
  }

  return (
    <main className={`${styles.page} appPageShell`}>
      <SectionHeader
        title="Cadastros do Financeiro"
        description="Contas, categorias e centros de custo."
        headingAs="h1"
        className={styles.header}
        actions={<BackButton fallbackHref="/finance" className={styles.linkMuted} />}
      />

      <section className={styles.formCard}>
        <div className={styles.row3}>
          <div className={styles.previewBox}>
            <div className={styles.kpiLabel}>Nova conta</div>
            <div className={styles.form} style={{ marginTop: 8 }}>
              <input
                className={styles.filterInput}
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="Nome da conta"
              />
              <UISelect
                className={styles.filterSelect}
                value={accountType}
                onChange={setAccountType}
                ariaLabel="Tipo da conta"
                options={[
                  { value: 'BANK', label: 'Banco' },
                  { value: 'CASH', label: 'Caixa' },
                  { value: 'DIGITAL', label: 'Digital' },
                ]}
              />
              <button
                type="button"
                className={styles.smallBtn}
                disabled={!accountName.trim()}
                onClick={async () => {
                  try {
                    await createCatalog('/api/finance/accounts', { name: accountName, type: accountType }, () =>
                      setAccountName(''),
                    );
                  } catch (e: unknown) {
                    setError(e instanceof Error ? e.message : String(e));
                  }
                }}
              >
                Adicionar conta
              </button>
            </div>
          </div>

          <div className={styles.previewBox}>
            <div className={styles.kpiLabel}>Nova categoria</div>
            <div className={styles.form} style={{ marginTop: 8 }}>
              <input
                className={styles.filterInput}
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="Nome da categoria"
              />
              <UISelect
                className={styles.filterSelect}
                value={categoryKind}
                onChange={setCategoryKind}
                ariaLabel="Tipo da categoria"
                options={[
                  { value: 'BOTH', label: 'Receber e pagar' },
                  { value: 'RECEIVABLE', label: 'Apenas receber' },
                  { value: 'PAYABLE', label: 'Apenas pagar' },
                ]}
              />
              <button
                type="button"
                className={styles.smallBtn}
                disabled={!categoryName.trim()}
                onClick={async () => {
                  try {
                    await createCatalog('/api/finance/categories', { name: categoryName, kind: categoryKind }, () =>
                      setCategoryName(''),
                    );
                  } catch (e: unknown) {
                    setError(e instanceof Error ? e.message : String(e));
                  }
                }}
              >
                Adicionar categoria
              </button>
            </div>
          </div>

          <div className={styles.previewBox}>
            <div className={styles.kpiLabel}>Novo centro de custo</div>
            <div className={styles.form} style={{ marginTop: 8 }}>
              <input
                className={styles.filterInput}
                value={costCenterName}
                onChange={(e) => setCostCenterName(e.target.value)}
                placeholder="Nome do centro de custo"
              />
              <button
                type="button"
                className={styles.smallBtn}
                disabled={!costCenterName.trim()}
                onClick={async () => {
                  try {
                    await createCatalog('/api/finance/cost-centers', { name: costCenterName }, () =>
                      setCostCenterName(''),
                    );
                  } catch (e: unknown) {
                    setError(e instanceof Error ? e.message : String(e));
                  }
                }}
              >
                Adicionar centro
              </button>
            </div>
          </div>
        </div>
        {error ? (
          <div className={styles.error} style={{ marginTop: 12 }}>
            {error}
          </div>
        ) : null}
      </section>

      <CatalogSection
        title="Contas"
        subtitle="Edição inline"
        items={accounts}
        kind="account"
        loading={loading}
        onReload={loadAll}
        onError={setError}
      />

      <CatalogSection
        title="Categorias"
        subtitle="Edição inline"
        items={categories}
        kind="category"
        loading={loading}
        onReload={loadAll}
        onError={setError}
      />

      <CatalogSection
        title="Centros de custo"
        subtitle="Edição inline"
        items={costCenters}
        kind="cost-center"
        loading={loading}
        onReload={loadAll}
        onError={setError}
      />
    </main>
  );
}
