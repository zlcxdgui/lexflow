'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BackButton } from '@/components/BackButton';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { UISelect } from '@/components/ui/Select';
import styles from '../../finance.module.css';

type CatalogItem = { id: string; name: string };

function datePartsInTimeZone(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(date);
  return {
    year: Number(parts.find((p) => p.type === 'year')?.value || '0'),
    month: Number(parts.find((p) => p.type === 'month')?.value || '1'),
    day: Number(parts.find((p) => p.type === 'day')?.value || '1'),
  };
}

function todayInTimeZone(timeZone: string) {
  const p = datePartsInTimeZone(new Date(), timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

async function parseJsonOrThrow(resp: Response) {
  const text = await resp.text();
  const contentType = resp.headers.get('content-type') || '';
  const asJson = contentType.includes('application/json');
  if (!resp.ok) {
    if (resp.status === 401 || resp.status === 403) {
      throw new Error('Você não tem permissão para esta ação.');
    }
    if (asJson) {
      try {
        const body = JSON.parse(text) as { message?: string };
        if (typeof body?.message === 'string' && body.message.trim()) throw new Error(body.message);
      } catch {}
    }
    throw new Error(text || 'Erro na requisição.');
  }
  if (!text) return null;
  if (!asJson) return text;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Resposta inválida do servidor.');
  }
}

export default function FinanceRecurrenceNewPage() {
  const router = useRouter();
  const [tenantTimeZone, setTenantTimeZone] = useState('America/Manaus');
  const [categories, setCategories] = useState<CatalogItem[]>([]);
  const [costCenters, setCostCenters] = useState<CatalogItem[]>([]);
  const [accounts, setAccounts] = useState<CatalogItem[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: '',
    direction: 'IN',
    description: '',
    categoryId: '',
    costCenterId: '',
    accountId: '',
    amountBRL: '',
    frequency: 'MONTHLY',
    dayOfMonth: '',
    startDate: todayInTimeZone('America/Manaus'),
    endDate: '',
  });

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [c, cc, a, meResp] = await Promise.all([
          fetch('/api/finance/categories', { cache: 'no-store' }),
          fetch('/api/finance/cost-centers', { cache: 'no-store' }),
          fetch('/api/finance/accounts', { cache: 'no-store' }),
          fetch('/api/auth/me', { cache: 'no-store' }),
        ]);
        const [categoriesData, costCentersData, accountsData] = await Promise.all([
          parseJsonOrThrow(c),
          parseJsonOrThrow(cc),
          parseJsonOrThrow(a),
        ]);
        let tz = 'America/Manaus';
        if (meResp.ok) {
          const meData = (await parseJsonOrThrow(meResp)) as { tenantTimezone?: string } | null;
          tz = String(meData?.tenantTimezone || 'America/Manaus');
        }
        setCategories(Array.isArray(categoriesData) ? categoriesData : []);
        setCostCenters(Array.isArray(costCentersData) ? costCentersData : []);
        setAccounts(Array.isArray(accountsData) ? accountsData : []);
        setTenantTimeZone(tz);
        setForm((p) => ({ ...p, startDate: todayInTimeZone(tz) }));
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleCreate() {
    try {
      setError('');
      setSaving(true);
      const cents = Math.round(Number(form.amountBRL.replace(/\./g, '').replace(',', '.')) * 100);
      if (!Number.isFinite(cents) || cents <= 0) {
        throw new Error('Informe um valor válido maior que zero.');
      }
      const dueDay = form.dayOfMonth ? Number(form.dayOfMonth) : null;
      if (dueDay != null && (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31)) {
        throw new Error('Dia de vencimento inválido. Use um valor entre 1 e 31.');
      }
      const resp = await fetch('/api/finance/recurrence-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          amountCents: cents,
          installmentsPerGeneration: 1,
          dayOfMonth: dueDay,
          startDate: form.startDate,
          endDate: form.endDate || null,
        }),
      });
      await parseJsonOrThrow(resp);
      router.replace('/finance/recurrence');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={`${styles.page} appPageShell`}>
      <SectionHeader
        title="Novo template recorrente"
        description="Configure vencimento e vigência para geração manual de lançamentos."
        headingAs="h1"
        className={styles.header}
        actions={<BackButton fallbackHref="/finance/recurrence" className={styles.linkMuted} />}
      />

      <section className={styles.formCard}>
        {loading ? (
          <div className={styles.metaMuted}>Carregando...</div>
        ) : (
          <div className={styles.form}>
            <div className={styles.row3}>
              <label className={styles.label}>
                Nome do template
                <input className={styles.filterInput} placeholder="Nome do template" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
              </label>
              <label className={styles.label}>
                Tipo
                <UISelect className={styles.filterSelect} value={form.direction} onChange={(value) => setForm((p) => ({ ...p, direction: value }))} ariaLabel="Tipo" options={[{ value: 'IN', label: 'Receber' }, { value: 'OUT', label: 'Pagar' }]} />
              </label>
              <label className={styles.label}>
                Descrição do lançamento
                <input className={styles.filterInput} placeholder="Descrição do lançamento" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
              </label>
            </div>
            <div className={styles.row3}>
              <label className={styles.label}>
                Categoria
                <UISelect className={styles.filterSelect} value={form.categoryId} onChange={(value) => setForm((p) => ({ ...p, categoryId: value }))} ariaLabel="Categoria" options={[{ value: '', label: 'Categoria' }, ...categories.map((x) => ({ value: x.id, label: x.name }))]} />
              </label>
              <label className={styles.label}>
                Centro de custo
                <UISelect className={styles.filterSelect} value={form.costCenterId} onChange={(value) => setForm((p) => ({ ...p, costCenterId: value }))} ariaLabel="Centro de custo" options={[{ value: '', label: 'Centro de custo' }, ...costCenters.map((x) => ({ value: x.id, label: x.name }))]} />
              </label>
              <label className={styles.label}>
                Conta
                <UISelect className={styles.filterSelect} value={form.accountId} onChange={(value) => setForm((p) => ({ ...p, accountId: value }))} ariaLabel="Conta" options={[{ value: '', label: 'Conta' }, ...accounts.map((x) => ({ value: x.id, label: x.name }))]} />
              </label>
            </div>
            <div className={styles.row3}>
              <label className={styles.label}>
                Valor (R$)
                <input className={styles.filterInput} placeholder="Valor (R$)" value={form.amountBRL} onChange={(e) => setForm((p) => ({ ...p, amountBRL: e.target.value }))} />
              </label>
              <label className={styles.label}>
                Frequência
                <UISelect className={styles.filterSelect} value={form.frequency} onChange={(value) => setForm((p) => ({ ...p, frequency: value }))} ariaLabel="Frequência" options={[{ value: 'MONTHLY', label: 'Mensal' }, { value: 'WEEKLY', label: 'Semanal' }, { value: 'YEARLY', label: 'Anual' }]} />
              </label>
              <label className={styles.label}>
                Dia de vencimento (1-31)
                <input className={styles.filterInput} type="number" min={1} max={31} placeholder="Dia de vencimento (1-31)" value={form.dayOfMonth} onChange={(e) => setForm((p) => ({ ...p, dayOfMonth: e.target.value }))} />
              </label>
            </div>
            <div className={styles.row3}>
              <label className={styles.label}>
                Início da vigência
                <input className={styles.filterInput} type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} />
              </label>
              <label className={styles.label}>
                Fim da vigência (opcional)
                <input className={styles.filterInput} type="date" value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} />
              </label>
              <div />
            </div>
            <div className={styles.metaMuted}>Vigência do template: início/fim. Fim é opcional. Timezone: {tenantTimeZone}.</div>
            <div className={styles.filterActions}>
              <button
                type="button"
                className={styles.primaryButton}
                disabled={
                  saving ||
                  !form.name.trim() ||
                  !form.description.trim() ||
                  !form.categoryId ||
                  !form.costCenterId ||
                  !form.accountId
                }
                onClick={handleCreate}
              >
                {saving ? 'Criando...' : 'Criar template'}
              </button>
              <Link href="/finance/recurrence" className={styles.ghostButton}>
                Cancelar
              </Link>
            </div>
            {error ? <div className={styles.error}>{error}</div> : null}
          </div>
        )}
      </section>
    </main>
  );
}
