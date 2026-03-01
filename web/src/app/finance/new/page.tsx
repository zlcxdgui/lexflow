'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { BackButton } from '@/components/BackButton';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { UISelect } from '@/components/ui/Select';
import styles from '../finance.module.css';

type ClientOption = { id: string; name: string; code?: number | null };
type MatterOption = { id: string; title: string; code?: number | null };
type FinanceCatalog = { id: string; name: string };

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

function toCents(input: string) {
  const normalized = input.replace(/\./g, '').replace(',', '.').trim();
  const n = Number(normalized);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

function addByFrequency(base: string, index: number, frequency: string) {
  const d = new Date(`${base}T12:00:00`);
  if (frequency === 'WEEKLY') d.setDate(d.getDate() + index * 7);
  else if (frequency === 'YEARLY') d.setFullYear(d.getFullYear() + index);
  else d.setMonth(d.getMonth() + index);
  return d.toISOString().slice(0, 10);
}

export default function FinanceNewPage() {
  const localToday = new Date().toISOString().slice(0, 10);
  const router = useRouter();
  const search = useSearchParams();
  const presetMatterId = search?.get('matterId') || '';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [matters, setMatters] = useState<MatterOption[]>([]);
  const [categories, setCategories] = useState<FinanceCatalog[]>([]);
  const [costCenters, setCostCenters] = useState<FinanceCatalog[]>([]);
  const [accounts, setAccounts] = useState<FinanceCatalog[]>([]);

  const [form, setForm] = useState({
    direction: 'IN',
    description: '',
    clientId: '',
    matterId: presetMatterId,
    categoryId: '',
    costCenterId: '',
    accountId: '',
    amountBRL: '',
    issueDate: localToday,
    competenceDate: '',
    installmentsCount: '1',
    firstDueDate: localToday,
    installmentFrequency: 'MONTHLY',
    notes: '',
  });

  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [clientsResp, mattersResp, categoriesResp, costCentersResp, accountsResp, meResp] = await Promise.all([
          fetch('/api/clients', { cache: 'no-store' }),
          fetch('/api/matters', { cache: 'no-store' }),
          fetch('/api/finance/categories', { cache: 'no-store' }),
          fetch('/api/finance/cost-centers', { cache: 'no-store' }),
          fetch('/api/finance/accounts', { cache: 'no-store' }),
          fetch('/api/auth/me', { cache: 'no-store' }),
        ]);
        const [clientsData, mattersData, categoriesData, costCentersData, accountsData, meData] = await Promise.all([
          clientsResp.json().catch(() => []),
          mattersResp.json().catch(() => []),
          categoriesResp.json().catch(() => []),
          costCentersResp.json().catch(() => []),
          accountsResp.json().catch(() => []),
          meResp.json().catch(() => null),
        ]);
        if (ignore) return;
        const tz = String((meData as { tenantTimezone?: string } | null)?.tenantTimezone || 'America/Manaus');
        const today = todayInTimeZone(tz);
        setClients(Array.isArray(clientsData) ? clientsData : []);
        setMatters(Array.isArray(mattersData) ? mattersData : []);
        setCategories(Array.isArray(categoriesData) ? categoriesData : []);
        setCostCenters(Array.isArray(costCentersData) ? costCentersData : []);
        setAccounts(Array.isArray(accountsData) ? accountsData : []);
        setForm((prev) => ({
          ...prev,
          issueDate: prev.issueDate === localToday ? today : prev.issueDate,
          firstDueDate: prev.firstDueDate === localToday ? today : prev.firstDueDate,
        }));
      } catch (e: unknown) {
        if (!ignore) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [localToday]);

  const amountCents = toCents(form.amountBRL);
  const installmentsPreview = useMemo(() => {
    const count = Math.max(1, Number(form.installmentsCount || '1') || 1);
    if (!amountCents || !form.firstDueDate) return [];
    const base = Math.floor(amountCents / count);
    const rem = amountCents - base * count;
    return Array.from({ length: count }, (_, i) => ({
      number: i + 1,
      amountCents: base + (i === count - 1 ? rem : 0),
      dueDate: addByFrequency(form.firstDueDate, i, form.installmentFrequency),
    }));
  }, [amountCents, form.installmentsCount, form.firstDueDate, form.installmentFrequency]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        direction: form.direction,
        description: form.description.trim(),
        notes: form.notes.trim() || null,
        clientId: form.clientId || null,
        matterId: form.matterId || null,
        categoryId: form.categoryId,
        costCenterId: form.costCenterId,
        accountId: form.accountId,
        issueDate: form.issueDate,
        competenceDate: form.competenceDate || null,
        totalAmountCents: amountCents,
        installmentsCount: Number(form.installmentsCount || '1') || 1,
        firstDueDate: form.firstDueDate,
        installmentFrequency: form.installmentFrequency,
      };
      const resp = await fetch('/api/finance/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const raw = await resp.text().catch(() => '');
        let message = raw || 'Não foi possível criar lançamento.';
        try {
          const parsed = JSON.parse(raw);
          message = Array.isArray(parsed?.message) ? parsed.message[0] : parsed?.message || message;
        } catch {}
        throw new Error(message);
      }
      const created = await resp.json();
      router.replace(`/finance/${created.id}`);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  return (
    <main className={`${styles.page} appPageShell`}>
      <SectionHeader
        title="Novo lançamento financeiro"
        description="Cadastre contas a receber ou a pagar com parcelamento e vínculo com caso/pessoa."
        headingAs="h1"
        className={styles.header}
        actions={<BackButton fallbackHref="/finance" className={styles.linkMuted} />}
      />

      <section className={styles.formCard}>
        <form className={styles.form} onSubmit={onSubmit}>
          <div className={styles.row}>
            <label className={styles.label}>
              <span>Tipo</span>
              <UISelect
                className={styles.filterSelect}
                value={form.direction}
                onChange={(value) => setForm((prev) => ({ ...prev, direction: value }))}
                ariaLabel="Tipo"
                options={[
                  { value: 'IN', label: 'Receber' },
                  { value: 'OUT', label: 'Pagar' },
                ]}
              />
            </label>
            <label className={styles.label}>
              <span>Descrição</span>
              <input
                className={styles.filterInput}
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Ex: Honorários iniciais - Caso Silva"
                required
              />
            </label>
          </div>

          <div className={styles.row}>
            <label className={styles.label}>
              <span>Pessoa</span>
              <UISelect
                className={styles.filterSelect}
                value={form.clientId}
                onChange={(value) => setForm((prev) => ({ ...prev, clientId: value }))}
                ariaLabel="Pessoa"
                loading={loading}
                options={[
                  { value: '', label: 'Selecione' },
                  ...clients.map((client) => ({ value: client.id, label: `${client.code ? `${client.code} - ` : ''}${client.name}` })),
                ]}
              />
            </label>
            <label className={styles.label}>
              <span>Caso</span>
              <UISelect
                className={styles.filterSelect}
                value={form.matterId}
                onChange={(value) => setForm((prev) => ({ ...prev, matterId: value }))}
                ariaLabel="Caso"
                loading={loading}
                options={[
                  { value: '', label: 'Selecione' },
                  ...matters.map((matter) => ({ value: matter.id, label: `${matter.code ? `${matter.code} - ` : ''}${matter.title}` })),
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
                onChange={(value) => setForm((prev) => ({ ...prev, categoryId: value }))}
                ariaLabel="Categoria"
                loading={loading}
                options={[
                  { value: '', label: 'Selecione' },
                  ...categories.map((item) => ({ value: item.id, label: item.name })),
                ]}
              />
            </label>
            <label className={styles.label}>
              <span>Centro de custo</span>
              <UISelect
                className={styles.filterSelect}
                value={form.costCenterId}
                onChange={(value) => setForm((prev) => ({ ...prev, costCenterId: value }))}
                ariaLabel="Centro de custo"
                loading={loading}
                options={[
                  { value: '', label: 'Selecione' },
                  ...costCenters.map((item) => ({ value: item.id, label: item.name })),
                ]}
              />
            </label>
            <label className={styles.label}>
              <span>Conta</span>
              <UISelect
                className={styles.filterSelect}
                value={form.accountId}
                onChange={(value) => setForm((prev) => ({ ...prev, accountId: value }))}
                ariaLabel="Conta"
                loading={loading}
                options={[
                  { value: '', label: 'Selecione' },
                  ...accounts.map((item) => ({ value: item.id, label: item.name })),
                ]}
              />
            </label>
          </div>

          <div className={styles.row3}>
            <label className={styles.label}>
              <span>Valor total (R$)</span>
              <input
                className={styles.filterInput}
                value={form.amountBRL}
                onChange={(e) => setForm((prev) => ({ ...prev, amountBRL: e.target.value }))}
                inputMode="decimal"
                placeholder="0,00"
                required
              />
            </label>
            <label className={styles.label}>
              <span>Emissão</span>
              <input
                className={styles.filterInput}
                type="date"
                value={form.issueDate}
                onChange={(e) => setForm((prev) => ({ ...prev, issueDate: e.target.value }))}
                required
              />
            </label>
            <label className={styles.label}>
              <span>Competência (opcional)</span>
              <input
                className={styles.filterInput}
                type="date"
                value={form.competenceDate}
                onChange={(e) => setForm((prev) => ({ ...prev, competenceDate: e.target.value }))}
              />
            </label>
          </div>

          <div className={styles.row3}>
            <label className={styles.label}>
              <span>Parcelas</span>
              <input
                className={styles.filterInput}
                type="number"
                min={1}
                max={360}
                value={form.installmentsCount}
                onChange={(e) => setForm((prev) => ({ ...prev, installmentsCount: e.target.value }))}
              />
            </label>
            <label className={styles.label}>
              <span>1º vencimento</span>
              <input
                className={styles.filterInput}
                type="date"
                value={form.firstDueDate}
                onChange={(e) => setForm((prev) => ({ ...prev, firstDueDate: e.target.value }))}
                required
              />
            </label>
            <label className={styles.label}>
              <span>Periodicidade</span>
              <UISelect
                className={styles.filterSelect}
                value={form.installmentFrequency}
                onChange={(value) => setForm((prev) => ({ ...prev, installmentFrequency: value }))}
                ariaLabel="Periodicidade"
                options={[
                  { value: 'MONTHLY', label: 'Mensal' },
                  { value: 'WEEKLY', label: 'Semanal' },
                  { value: 'YEARLY', label: 'Anual' },
                ]}
              />
            </label>
          </div>

          <label className={styles.label}>
            <span>Observações</span>
            <textarea
              className={`${styles.filterInput} ${styles.textarea}`}
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Observações internas (opcional)"
            />
          </label>

          <div className={styles.previewBox}>
            <div className={styles.kpiLabel}>Preview de parcelas</div>
            {installmentsPreview.length === 0 ? (
              <div className={styles.metaMuted}>Informe valor e vencimento para visualizar as parcelas.</div>
            ) : (
              <div className={styles.form} style={{ gap: 6 }}>
                {installmentsPreview.map((item) => (
                  <div key={item.number} className={styles.metaMuted}>
                    Parcela {item.number}: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.amountCents / 100)} · venc. {item.dueDate}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={styles.headerActions}>
            <button type="submit" className={styles.primaryButton} disabled={saving}>
              {saving ? 'Salvando...' : 'Criar lançamento'}
            </button>
            <Link href="/finance" className={styles.ghostButton}>Cancelar</Link>
          </div>

          {error ? <div className={styles.error}>{error}</div> : null}
        </form>
      </section>
    </main>
  );
}
