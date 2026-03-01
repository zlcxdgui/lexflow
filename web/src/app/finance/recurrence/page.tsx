'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BackButton } from '@/components/BackButton';
import { ActionMenu } from '@/components/ActionMenu';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { UISelect } from '@/components/ui/Select';
import { FinanceModal } from '../FinanceModal';
import styles from '../finance.module.css';

type CatalogItem = { id: string; name: string; code?: number | null };
type TemplateItem = {
  id: string;
  name: string;
  description?: string;
  direction: string;
  frequency: string;
  amountCents: number;
  isActive: boolean;
  dayOfMonth?: number | null;
  startDate?: string;
  endDate?: string | null;
  category?: { name: string } | null;
  categoryId?: string;
  costCenter?: { name: string } | null;
  costCenterId?: string;
  account?: { name: string } | null;
  accountId?: string;
};

function formatMoney(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100);
}

function frequencyLabel(value: string) {
  const normalized = String(value || '').toUpperCase();
  if (normalized === 'MONTHLY') return 'Mensal';
  if (normalized === 'WEEKLY') return 'Semanal';
  if (normalized === 'YEARLY') return 'Anual';
  return value || '-';
}

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

function formatDatePtBr(value?: string | null) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function recurrenceFriendlyError(message: string, tpl?: TemplateItem | null) {
  const normalized = String(message || '').toLowerCase();
  if (normalized.includes('competência anterior ao início do template')) {
    const dateLabel = formatDatePtBr(tpl?.startDate || null);
    return `Este template inicia em ${dateLabel}. Altere a data inicial do template ou gere a competência correta.`;
  }
  return message;
}

function recurrenceFriendlyErrorFromRaw(message: string) {
  return recurrenceFriendlyError(message, null);
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

export default function FinanceRecurrencePage() {
  const [tenantTimeZone, setTenantTimeZone] = useState('America/Manaus');
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [categories, setCategories] = useState<CatalogItem[]>([]);
  const [costCenters, setCostCenters] = useState<CatalogItem[]>([]);
  const [accounts, setAccounts] = useState<CatalogItem[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [generatingRange, setGeneratingRange] = useState(false);
  const [generatingTemplateId, setGeneratingTemplateId] = useState<string | null>(null);
  const [togglingTemplateId, setTogglingTemplateId] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<TemplateItem | null>(null);
  const [inactivateTarget, setInactivateTarget] = useState<TemplateItem | null>(null);
  const [editForm, setEditForm] = useState({
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
    isActive: true,
  });

  async function loadAll(options?: { keepFeedback?: boolean }) {
    setLoading(true);
    if (!options?.keepFeedback) {
      setError('');
      setSuccess('');
    }
    try {
      const [t, c, cc, a] = await Promise.all([
        fetch('/api/finance/recurrence-templates', { cache: 'no-store' }),
        fetch('/api/finance/categories', { cache: 'no-store' }),
        fetch('/api/finance/cost-centers', { cache: 'no-store' }),
        fetch('/api/finance/accounts', { cache: 'no-store' }),
      ]);
      const meResp = await fetch('/api/auth/me', { cache: 'no-store' });
      const [templatesData, categoriesData, costCentersData, accountsData] = await Promise.all([
        parseJsonOrThrow(t),
        parseJsonOrThrow(c),
        parseJsonOrThrow(cc),
        parseJsonOrThrow(a),
      ]);
      let tz = 'America/Manaus';
      if (meResp.ok) {
        const meData = (await parseJsonOrThrow(meResp)) as { tenantTimezone?: string } | null;
        tz = String(meData?.tenantTimezone || 'America/Manaus');
      }
      setTemplates(Array.isArray(templatesData) ? templatesData : []);
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
      setCostCenters(Array.isArray(costCentersData) ? costCentersData : []);
      setAccounts(Array.isArray(accountsData) ? accountsData : []);
      setTenantTimeZone(tz);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  function openEditModal(tpl: TemplateItem) {
    setEditingTemplate(tpl);
    setEditForm({
      name: tpl.name || '',
      direction: String(tpl.direction || 'IN').toUpperCase() === 'OUT' ? 'OUT' : 'IN',
      description: tpl.description || '',
      categoryId: tpl.categoryId || '',
      costCenterId: tpl.costCenterId || '',
      accountId: tpl.accountId || '',
      amountBRL: String((Number(tpl.amountCents || 0) / 100).toFixed(2)).replace('.', ','),
      frequency: String(tpl.frequency || 'MONTHLY').toUpperCase(),
      dayOfMonth: tpl.dayOfMonth ? String(tpl.dayOfMonth) : '',
      startDate: tpl.startDate
        ? String(tpl.startDate).slice(0, 10)
        : todayInTimeZone(tenantTimeZone),
      endDate: tpl.endDate ? String(tpl.endDate).slice(0, 10) : '',
      isActive: Boolean(tpl.isActive),
    });
  }

  async function toggleTemplateActive(tpl: TemplateItem, nextActive: boolean) {
    try {
      setError('');
      setSuccess('');
      setTogglingTemplateId(tpl.id);
      const resp = await fetch(`/api/finance/recurrence-templates/${tpl.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: nextActive }),
      });
      await parseJsonOrThrow(resp);
      setSuccess(`Template "${tpl.name}" ${nextActive ? 'ativado' : 'inativado'} com sucesso.`);
      await loadAll({ keepFeedback: true });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setTogglingTemplateId(null);
    }
  }

  async function generateFromTemplate(tpl: TemplateItem) {
    try {
      setError('');
      setSuccess('');
      setGeneratingTemplateId(tpl.id);
      const resp = await fetch(`/api/finance/recurrence-templates/${tpl.id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await parseJsonOrThrow(resp);
      setSuccess(`Recorrência gerada para o template "${tpl.name}".`);
      await loadAll();
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : String(e);
      setError(recurrenceFriendlyError(raw, tpl));
    } finally {
      setGeneratingTemplateId(null);
    }
  }

  return (
    <main className={`${styles.page} appPageShell`}>
      <SectionHeader
        title="Recorrência Financeira"
        description="Templates recorrentes para geração manual de lançamentos."
        headingAs="h1"
        className={styles.header}
        actions={<BackButton fallbackHref="/finance" className={styles.linkMuted} />}
      />

      <section className={styles.formCard}>
        <div className={styles.filterActions}>
            <Link href="/finance/recurrence/new" className={styles.primaryButton}>
              Criar template
            </Link>
            <button
              type="button"
              className={styles.ghostButton}
              disabled={generatingRange}
              onClick={async () => {
                try {
                  setError('');
                  setSuccess('');
                  setGeneratingRange(true);
                  const nowParts = datePartsInTimeZone(new Date(), tenantTimeZone);
                  const from = `${nowParts.year}-${String(nowParts.month).padStart(2, '0')}-01`;
                  const lastDay = new Date(nowParts.year, nowParts.month, 0).getDate();
                  const to = `${nowParts.year}-${String(nowParts.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
                  const resp = await fetch('/api/finance/recurrence/generate-range', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ from, to }),
                  });
                  const result = (await parseJsonOrThrow(resp)) as {
                    generatedCount?: number;
                    errors?: Array<{ templateId?: string; error?: string }>;
                  } | null;
                  const count = Number(result?.generatedCount || 0);
                  const errors = Array.isArray(result?.errors) ? result!.errors : [];
                  setSuccess(
                    count > 0
                      ? `${count} lançamento(s) gerado(s) no mês atual.`
                      : errors.length
                        ? ''
                        : 'Nenhum lançamento novo foi gerado (já existentes ou sem templates válidos).',
                  );
                  if (count === 0 && errors.length) {
                    const first = errors[0];
                    const templateName =
                      templates.find((tpl) => tpl.id === String(first?.templateId || ''))?.name ||
                      'template';
                    const reason = recurrenceFriendlyErrorFromRaw(String(first?.error || 'Falha na geração'));
                    setError(`Não foi possível gerar para "${templateName}": ${reason}`);
                  }
                  await loadAll({ keepFeedback: true });
                } catch (e: unknown) {
                  setError(e instanceof Error ? e.message : String(e));
                } finally {
                  setGeneratingRange(false);
                }
              }}
            >
              {generatingRange ? 'Gerando...' : 'Gerar recorrências (mês atual)'}
            </button>
        </div>
        {error ? <div className={styles.error}>{error}</div> : null}
        {success ? <div className={styles.metaMuted}>{success}</div> : null}
      </section>

      <section className="appDataTableWrap appListTableCard" style={{ marginTop: 14 }}>
        <table className="appDataTable">
          <thead>
            <tr>
              <th>Ações</th>
              <th>Template</th>
              <th>Tipo</th>
              <th>Frequência</th>
              <th>Vencimento</th>
              <th>Vigência</th>
              <th>Valor</th>
              <th>Categoria</th>
              <th>Conta</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="appDataTableEmpty">Carregando...</td></tr>
            ) : templates.length === 0 ? (
              <tr><td colSpan={10} className="appDataTableEmpty">Nenhum template recorrente.</td></tr>
            ) : templates.map((tpl) => (
              <tr key={tpl.id}>
                <td>
                  <ActionMenu triggerAriaLabel="Ações do template recorrente">
                    {({ close }) => (
                      <>
                        <button
                          type="button"
                          className={styles.menuItem}
                          onClick={() => {
                            close();
                            openEditModal(tpl);
                          }}
                        >
                          <span className={styles.menuIcon}>✎</span>
                          Editar
                        </button>
                        <button
                          type="button"
                          className={styles.menuItem}
                          disabled={togglingTemplateId === tpl.id}
                          onClick={async () => {
                            close();
                            if (tpl.isActive) {
                              setInactivateTarget(tpl);
                              return;
                            }
                            await toggleTemplateActive(tpl, true);
                          }}
                        >
                          <span className={styles.menuIcon}>{tpl.isActive ? '⏸' : '▶'}</span>
                          {tpl.isActive ? 'Inativar' : 'Ativar'}
                        </button>
                        <button
                          type="button"
                          className={styles.menuItem}
                          disabled={generatingTemplateId === tpl.id}
                          onClick={async () => {
                            close();
                            await generateFromTemplate(tpl);
                          }}
                        >
                          <span className={styles.menuIcon}>↺</span>
                          {generatingTemplateId === tpl.id ? 'Gerando...' : 'Gerar agora'}
                        </button>
                      </>
                    )}
                  </ActionMenu>
                </td>
                <td>{tpl.name}</td>
                <td>{tpl.direction === 'IN' ? 'Receber' : 'Pagar'}</td>
                <td>{frequencyLabel(tpl.frequency)}</td>
                <td>{tpl.dayOfMonth ? `Dia ${tpl.dayOfMonth}` : '-'}</td>
                <td>{`${formatDatePtBr(tpl.startDate)} até ${formatDatePtBr(tpl.endDate || null)}`}</td>
                <td>{formatMoney(tpl.amountCents)}</td>
                <td>{tpl.category?.name || '-'}</td>
                <td>{tpl.account?.name || '-'}</td>
                <td><span className={tpl.isActive ? `${styles.pill} ${styles.pillSettled}` : `${styles.pill} ${styles.pillCanceled}`}>{tpl.isActive ? 'Ativo' : 'Inativo'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <FinanceModal
        open={Boolean(editingTemplate)}
        ariaLabel="Editar template de recorrência"
        title="Editar template"
        description="Altere os dados do template recorrente."
        size="lg"
      >
        <div className={styles.form} style={{ marginTop: 10 }}>
          <div className={styles.row}>
            <label className={styles.label}>
              Nome do template
              <input
                className={styles.filterInput}
                placeholder="Nome do template"
                value={editForm.name}
                onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
              />
            </label>
            <label className={styles.label}>
              Tipo
              <UISelect
                className={styles.filterSelect}
                value={editForm.direction}
                onChange={(value) => setEditForm((p) => ({ ...p, direction: value }))}
                ariaLabel="Direção"
                options={[{ value: 'IN', label: 'Receber' }, { value: 'OUT', label: 'Pagar' }]}
              />
            </label>
          </div>
          <label className={styles.label}>
            Descrição do lançamento
            <input
              className={styles.filterInput}
              placeholder="Descrição do lançamento"
              value={editForm.description}
              onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
            />
          </label>
          <div className={styles.row3}>
            <label className={styles.label}>
              Categoria
              <UISelect
                className={styles.filterSelect}
                value={editForm.categoryId}
                onChange={(value) => setEditForm((p) => ({ ...p, categoryId: value }))}
                ariaLabel="Categoria"
                options={[{ value: '', label: 'Categoria' }, ...categories.map((x) => ({ value: x.id, label: x.name }))]}
              />
            </label>
            <label className={styles.label}>
              Centro de custo
              <UISelect
                className={styles.filterSelect}
                value={editForm.costCenterId}
                onChange={(value) => setEditForm((p) => ({ ...p, costCenterId: value }))}
                ariaLabel="Centro de custo"
                options={[{ value: '', label: 'Centro de custo' }, ...costCenters.map((x) => ({ value: x.id, label: x.name }))]}
              />
            </label>
            <label className={styles.label}>
              Conta
              <UISelect
                className={styles.filterSelect}
                value={editForm.accountId}
                onChange={(value) => setEditForm((p) => ({ ...p, accountId: value }))}
                ariaLabel="Conta"
                options={[{ value: '', label: 'Conta' }, ...accounts.map((x) => ({ value: x.id, label: x.name }))]}
              />
            </label>
          </div>
          <div className={styles.row3}>
            <label className={styles.label}>
              Valor (R$)
              <input
                className={styles.filterInput}
                placeholder="Valor (R$)"
                value={editForm.amountBRL}
                onChange={(e) => setEditForm((p) => ({ ...p, amountBRL: e.target.value }))}
              />
            </label>
            <label className={styles.label}>
              Frequência
              <UISelect
                className={styles.filterSelect}
                value={editForm.frequency}
                onChange={(value) => setEditForm((p) => ({ ...p, frequency: value }))}
                ariaLabel="Frequência"
                options={[{ value: 'MONTHLY', label: 'Mensal' }, { value: 'WEEKLY', label: 'Semanal' }, { value: 'YEARLY', label: 'Anual' }]}
              />
            </label>
            <label className={styles.label}>
              Dia de vencimento (1-31)
              <input
                className={styles.filterInput}
                type="number"
                min={1}
                max={31}
                placeholder="Dia de vencimento (1-31)"
                value={editForm.dayOfMonth}
                onChange={(e) => setEditForm((p) => ({ ...p, dayOfMonth: e.target.value }))}
              />
            </label>
          </div>
          <div className={styles.row3}>
            <label className={styles.label}>
              Início da vigência
              <input
                className={styles.filterInput}
                type="date"
                aria-label="Início da vigência"
                title="Início da vigência"
                value={editForm.startDate}
                onChange={(e) => setEditForm((p) => ({ ...p, startDate: e.target.value }))}
              />
            </label>
            <label className={styles.label}>
              Fim da vigência (opcional)
              <input
                className={styles.filterInput}
                type="date"
                aria-label="Fim da vigência (opcional)"
                title="Fim da vigência (opcional)"
                value={editForm.endDate}
                onChange={(e) => setEditForm((p) => ({ ...p, endDate: e.target.value }))}
              />
            </label>
            <div />
          </div>
          <div className={styles.metaMuted}>Vigência do template: início/fim. Fim é opcional.</div>
          <div className={styles.filterActions}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={async () => {
                if (!editingTemplate) return;
                try {
                  setError('');
                  setSuccess('');
                  const cents = Math.round(Number(editForm.amountBRL.replace(/\./g, '').replace(',', '.')) * 100);
                  if (!Number.isFinite(cents) || cents <= 0) {
                    throw new Error('Informe um valor válido maior que zero.');
                  }
                  const dueDay = editForm.dayOfMonth ? Number(editForm.dayOfMonth) : null;
                  if (dueDay != null && (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31)) {
                    throw new Error('Dia de vencimento inválido. Use um valor entre 1 e 31.');
                  }
                  const resp = await fetch(`/api/finance/recurrence-templates/${editingTemplate.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      name: editForm.name.trim(),
                      direction: editForm.direction,
                      description: editForm.description.trim(),
                      categoryId: editForm.categoryId,
                      costCenterId: editForm.costCenterId,
                      accountId: editForm.accountId,
                      amountCents: cents,
                      frequency: editForm.frequency,
                      dayOfMonth: dueDay,
                      startDate: editForm.startDate,
                      endDate: editForm.endDate || null,
                      isActive: editForm.isActive,
                    }),
                  });
                  await parseJsonOrThrow(resp);
                  setSuccess(`Template "${editForm.name}" atualizado com sucesso.`);
                  setEditingTemplate(null);
                          await loadAll({ keepFeedback: true });
                } catch (e: unknown) {
                  setError(e instanceof Error ? e.message : String(e));
                }
              }}
            >
              Salvar alterações
            </button>
            <button
              type="button"
              className={styles.ghostButton}
              onClick={() => setEditingTemplate(null)}
            >
              Fechar
            </button>
          </div>
        </div>
      </FinanceModal>

      <FinanceModal
        open={Boolean(inactivateTarget)}
        ariaLabel="Confirmar inativação de template"
        title="Inativar template"
        description={
          inactivateTarget
            ? `Deseja inativar o template "${inactivateTarget.name}"? Templates inativos não geram novos lançamentos.`
            : undefined
        }
      >
        <div className={styles.filterActions} style={{ marginTop: 12 }}>
          <button
            type="button"
            className={`${styles.smallBtn} ${styles.smallBtnDanger}`}
            disabled={!inactivateTarget || togglingTemplateId === inactivateTarget.id}
            onClick={async () => {
              if (!inactivateTarget) return;
              await toggleTemplateActive(inactivateTarget, false);
              setInactivateTarget(null);
            }}
          >
            {inactivateTarget && togglingTemplateId === inactivateTarget.id ? 'Inativando...' : 'Confirmar inativação'}
          </button>
          <button
            type="button"
            className={styles.smallBtn}
            onClick={() => setInactivateTarget(null)}
          >
            Cancelar
          </button>
        </div>
      </FinanceModal>
    </main>
  );
}
