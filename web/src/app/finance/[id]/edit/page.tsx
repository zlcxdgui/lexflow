'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { BackButton } from '@/components/BackButton';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { UISelect } from '@/components/ui/Select';
import styles from '../../finance.module.css';

type FinanceEntryDetail = {
  id: string;
  code: number;
  description: string;
  notes?: string | null;
  issueDate: string;
  competenceDate?: string | null;
  clientId?: string | null;
  matterId?: string | null;
  categoryId: string;
  costCenterId: string;
  accountId: string;
  installments?: Array<{ effectiveStatus?: string }>;
};

type ClientOption = { id: string; name: string; code?: number | null };
type MatterOption = { id: string; title: string; code?: number | null };
type CatalogItem = { id: string; name: string };

export default function FinanceEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = String(params?.id || '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [entry, setEntry] = useState<FinanceEntryDetail | null>(null);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [matters, setMatters] = useState<MatterOption[]>([]);
  const [categories, setCategories] = useState<CatalogItem[]>([]);
  const [costCenters, setCostCenters] = useState<CatalogItem[]>([]);
  const [accounts, setAccounts] = useState<CatalogItem[]>([]);
  const [form, setForm] = useState({
    description: '',
    notes: '',
    clientId: '',
    matterId: '',
    categoryId: '',
    costCenterId: '',
    accountId: '',
    issueDate: '',
    competenceDate: '',
  });

  useEffect(() => {
    let ignore = false;
    (async () => {
      if (!id) return;
      setLoading(true);
      setError('');
      try {
        const [entryResp, clientsResp, mattersResp, categoriesResp, costCentersResp, accountsResp] = await Promise.all([
          fetch(`/api/finance/entries/${id}`, { cache: 'no-store' }),
          fetch('/api/clients', { cache: 'no-store' }),
          fetch('/api/matters', { cache: 'no-store' }),
          fetch('/api/finance/categories', { cache: 'no-store' }),
          fetch('/api/finance/cost-centers', { cache: 'no-store' }),
          fetch('/api/finance/accounts', { cache: 'no-store' }),
        ]);
        if (!entryResp.ok) {
          throw new Error(await entryResp.text().catch(() => 'Erro ao carregar lançamento'));
        }
        const [entryData, clientsData, mattersData, categoriesData, costCentersData, accountsData] = await Promise.all([
          entryResp.json(),
          clientsResp.json().catch(() => []),
          mattersResp.json().catch(() => []),
          categoriesResp.json().catch(() => []),
          costCentersResp.json().catch(() => []),
          accountsResp.json().catch(() => []),
        ]);
        if (ignore) return;
        const loadedEntry = entryData as FinanceEntryDetail;
        setEntry(loadedEntry);
        setClients(Array.isArray(clientsData) ? clientsData : []);
        setMatters(Array.isArray(mattersData) ? mattersData : []);
        setCategories(Array.isArray(categoriesData) ? categoriesData : []);
        setCostCenters(Array.isArray(costCentersData) ? costCentersData : []);
        setAccounts(Array.isArray(accountsData) ? accountsData : []);
        setForm({
          description: loadedEntry.description || '',
          notes: loadedEntry.notes || '',
          clientId: loadedEntry.clientId || '',
          matterId: loadedEntry.matterId || '',
          categoryId: loadedEntry.categoryId || '',
          costCenterId: loadedEntry.costCenterId || '',
          accountId: loadedEntry.accountId || '',
          issueDate: loadedEntry.issueDate ? String(loadedEntry.issueDate).slice(0, 10) : '',
          competenceDate: loadedEntry.competenceDate ? String(loadedEntry.competenceDate).slice(0, 10) : '',
        });
      } catch (e: unknown) {
        if (!ignore) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [id]);

  const hasSettledInstallments = useMemo(
    () =>
      Boolean(
        entry?.installments?.some(
          (inst) => String(inst.effectiveStatus || '').toUpperCase() === 'SETTLED',
        ),
      ),
    [entry],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        description: form.description.trim(),
        notes: form.notes.trim() || null,
        clientId: form.clientId || null,
        matterId: form.matterId || null,
        categoryId: form.categoryId || undefined,
        costCenterId: form.costCenterId || undefined,
        accountId: form.accountId || undefined,
        issueDate: form.issueDate || undefined,
        competenceDate: form.competenceDate || null,
      };
      const resp = await fetch(`/api/finance/entries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const raw = await resp.text().catch(() => '');
        let message = raw || 'Não foi possível atualizar lançamento.';
        try {
          const parsed = JSON.parse(raw);
          message = Array.isArray(parsed?.message) ? parsed.message[0] : parsed?.message || message;
        } catch {}
        throw new Error(message);
      }
      router.replace(`/finance/${id}`);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  return (
    <main className={`${styles.page} appPageShell`}>
      <SectionHeader
        title={entry ? `Editar lançamento #${entry.code}` : 'Editar lançamento'}
        description={
          hasSettledInstallments
            ? 'Campos estruturais foram bloqueados porque já existe baixa em parcela.'
            : 'Altere os dados do lançamento. Parcelas e baixas permanecem no detalhe.'
        }
        headingAs="h1"
        className={styles.header}
        actions={<BackButton fallbackHref={id ? `/finance/${id}` : '/finance'} className={styles.linkMuted} />}
      />

      <section className={styles.formCard}>
        {loading ? (
          <div className={styles.metaMuted}>Carregando...</div>
        ) : (
          <form className={styles.form} onSubmit={onSubmit}>
            <div className={styles.row}>
              <label className={styles.label}>
                <span>Descrição</span>
                <input
                  className={styles.filterInput}
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  required
                />
              </label>
              <label className={styles.label}>
                <span>Data de emissão</span>
                <input
                  className={styles.filterInput}
                  type="date"
                  value={form.issueDate}
                  onChange={(e) => setForm((p) => ({ ...p, issueDate: e.target.value }))}
                  disabled={hasSettledInstallments}
                />
              </label>
            </div>

            <div className={styles.row}>
              <label className={styles.label}>
                <span>Pessoa</span>
                <UISelect
                  className={styles.filterSelect}
                  value={form.clientId}
                  onChange={(value) => setForm((p) => ({ ...p, clientId: value }))}
                  ariaLabel="Pessoa"
                  disabled={hasSettledInstallments}
                  options={[
                    { value: '', label: 'Selecione' },
                    ...clients.map((c) => ({ value: c.id, label: `${c.code ? `${c.code} - ` : ''}${c.name}` })),
                  ]}
                />
              </label>
              <label className={styles.label}>
                <span>Caso</span>
                <UISelect
                  className={styles.filterSelect}
                  value={form.matterId}
                  onChange={(value) => setForm((p) => ({ ...p, matterId: value }))}
                  ariaLabel="Caso"
                  disabled={hasSettledInstallments}
                  options={[
                    { value: '', label: 'Selecione' },
                    ...matters.map((m) => ({ value: m.id, label: `${m.code ? `${m.code} - ` : ''}${m.title}` })),
                  ]}
                />
              </label>
            </div>

            <div className={styles.row3}>
              <label className={styles.label}>
                <span>Categoria</span>
                <UISelect
                  className={styles.filterSelect}
                  value={form.categoryId}
                  onChange={(value) => setForm((p) => ({ ...p, categoryId: value }))}
                  ariaLabel="Categoria"
                  disabled={hasSettledInstallments}
                  options={[
                    { value: '', label: 'Selecione' },
                    ...categories.map((x) => ({ value: x.id, label: x.name })),
                  ]}
                />
              </label>
              <label className={styles.label}>
                <span>Centro de custo</span>
                <UISelect
                  className={styles.filterSelect}
                  value={form.costCenterId}
                  onChange={(value) => setForm((p) => ({ ...p, costCenterId: value }))}
                  ariaLabel="Centro de custo"
                  disabled={hasSettledInstallments}
                  options={[
                    { value: '', label: 'Selecione' },
                    ...costCenters.map((x) => ({ value: x.id, label: x.name })),
                  ]}
                />
              </label>
              <label className={styles.label}>
                <span>Conta padrão</span>
                <UISelect
                  className={styles.filterSelect}
                  value={form.accountId}
                  onChange={(value) => setForm((p) => ({ ...p, accountId: value }))}
                  ariaLabel="Conta padrão"
                  disabled={hasSettledInstallments}
                  options={[
                    { value: '', label: 'Selecione' },
                    ...accounts.map((x) => ({ value: x.id, label: x.name })),
                  ]}
                />
              </label>
            </div>

            <div className={styles.row}>
              <label className={styles.label}>
                <span>Competência (opcional)</span>
                <input
                  className={styles.filterInput}
                  type="date"
                  value={form.competenceDate}
                  onChange={(e) => setForm((p) => ({ ...p, competenceDate: e.target.value }))}
                  disabled={hasSettledInstallments}
                />
              </label>
              <label className={styles.label}>
                <span>Observações</span>
                <input
                  className={styles.filterInput}
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Opcional"
                />
              </label>
            </div>

            {hasSettledInstallments ? (
              <div className={styles.previewBox}>
                <div className={styles.metaMuted}>
                  Existem parcelas baixadas. O backend bloqueará alterações estruturais (pessoa/caso/categoria/centro/conta/emissão/competência).
                </div>
              </div>
            ) : null}

            <div className={styles.headerActions}>
              <button type="submit" className={styles.primaryButton} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar alterações'}
              </button>
              <Link href={id ? `/finance/${id}` : '/finance'} className={styles.ghostButton}>
                Cancelar
              </Link>
            </div>

            {error ? <div className={styles.error}>{error}</div> : null}
          </form>
        )}
      </section>
    </main>
  );
}

