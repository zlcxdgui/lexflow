'use client';

import { useEffect, useState, startTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UISelect } from '@/components/ui/Select';
import { FinanceModal } from './FinanceModal';
import { FinanceModalActions } from './FinanceModalActions';
import { FinanceModalError } from './FinanceModalError';
import styles from './finance.module.css';

type Installment = {
  id: string;
  number?: number;
  description?: string | null;
  effectiveStatus?: string;
  amountCents: number;
  dueDate?: string;
  paidAmountCents?: number | null;
  paymentMethod?: string | null;
};

type AccountOption = { id: string; name: string };

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

function centsToBRLInput(cents: number) {
  return (cents / 100).toFixed(2).replace('.', ',');
}

function brlInputToCents(input: string) {
  const n = Number(String(input || '').replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export function FinanceInstallmentActions({
  installment,
}: {
  installment: Installment;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [settleError, setSettleError] = useState('');
  const [editError, setEditError] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [tenantTimeZone, setTenantTimeZone] = useState('America/Manaus');
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [settleForm, setSettleForm] = useState({
    paidAt: todayInTimeZone('America/Manaus'),
    paidAmountBRL: centsToBRLInput(installment.amountCents),
    discountBRL: '0,00',
    interestBRL: '0,00',
    fineBRL: '0,00',
    accountId: '',
    paymentMethod: '',
    notes: '',
  });
  const [editForm, setEditForm] = useState({
    dueDate: String(installment.dueDate || '').slice(0, 10),
    description: installment.description || '',
  });

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const resp = await fetch('/api/auth/me', { cache: 'no-store' });
        const data = await resp.json().catch(() => null);
        const tz = String((data as { tenantTimezone?: string } | null)?.tenantTimezone || 'America/Manaus');
        if (!ignore) {
          setTenantTimeZone(tz);
          setSettleForm((p) => ({ ...p, paidAt: p.paidAt || todayInTimeZone(tz) }));
        }
      } catch {
        if (!ignore) setTenantTimeZone('America/Manaus');
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!settleOpen || accountsLoaded) return;
    let ignore = false;
    (async () => {
      setAccountsLoading(true);
      try {
        const resp = await fetch('/api/finance/accounts', { cache: 'no-store' });
        const data = await resp.json().catch(() => []);
        if (!ignore) setAccounts(Array.isArray(data) ? data : []);
      } catch {
        if (!ignore) setAccounts([]);
      } finally {
        if (!ignore) {
          setAccountsLoading(false);
          setAccountsLoaded(true);
        }
      }
    })();
    return () => {
      ignore = true;
    };
  }, [settleOpen, accountsLoaded]);

  async function settleDetailed(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setSettleError('');
    try {
      const resp = await fetch(`/api/finance/installments/${installment.id}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paidAt: settleForm.paidAt,
          paidAmountCents: brlInputToCents(settleForm.paidAmountBRL),
          discountCents: brlInputToCents(settleForm.discountBRL),
          interestCents: brlInputToCents(settleForm.interestBRL),
          fineCents: brlInputToCents(settleForm.fineBRL),
          accountId: settleForm.accountId || null,
          paymentMethod: settleForm.paymentMethod || null,
          notes: settleForm.notes.trim() || null,
        }),
      });
      if (!resp.ok) throw new Error(await resp.text().catch(() => 'Erro ao dar baixa'));
      setSettleOpen(false);
      startTransition(() => router.refresh());
    } catch (e) {
      setSettleError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function cancelInstallment() {
    if (saving) return;
    setSaving(true);
    setCancelError('');
    try {
      const reason = cancelReason.trim();
      if (!reason) throw new Error('Motivo do cancelamento é obrigatório');
      const resp = await fetch(`/api/finance/installments/${installment.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!resp.ok) throw new Error(await resp.text().catch(() => 'Erro ao cancelar'));
      setCancelOpen(false);
      setCancelReason('');
      startTransition(() => router.refresh());
    } catch (e) {
      setCancelError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function submitCancelInstallment(e: React.FormEvent) {
    e.preventDefault();
    await cancelInstallment();
  }

  async function cancelInstallmentLegacy() {
    if (saving) return;
    setCancelError('');
    setCancelReason('');
    setCancelOpen(true);
  }

  async function updateInstallment(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setEditError('');
    try {
      const payload: Record<string, unknown> = {
        dueDate: editForm.dueDate,
        description: editForm.description.trim() || null,
      };
      const resp = await fetch(`/api/finance/installments/${installment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) throw new Error(await resp.text().catch(() => 'Erro ao editar parcela'));
      setEditOpen(false);
      startTransition(() => router.refresh());
    } catch (e) {
      setEditError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const status = String(installment.effectiveStatus || '').toUpperCase();
  const canSettle = status === 'OPEN' || status === 'OVERDUE';
  const canCancel = status === 'OPEN' || status === 'OVERDUE';
  const canEdit = status === 'OPEN' || status === 'OVERDUE';

  return (
    <div className={styles.rowActions}>
      {canSettle ? (
        <button
          type="button"
          className={styles.smallBtn}
          disabled={saving}
          onClick={() => {
            setSettleForm((p) => ({ ...p, paidAt: todayInTimeZone(tenantTimeZone) }));
            setSettleOpen(true);
          }}
        >
          Baixar
        </button>
      ) : null}
      {canCancel ? (
        <button type="button" className={`${styles.smallBtn} ${styles.smallBtnDanger}`} disabled={saving} onClick={cancelInstallmentLegacy}>
          Cancelar
        </button>
      ) : null}
      {canEdit ? (
        <button
          type="button"
          className={styles.smallBtn}
          disabled={saving}
          onClick={() => {
            setEditForm({
              dueDate: String(installment.dueDate || '').slice(0, 10),
              description: installment.description || '',
            });
            setEditError('');
            setEditOpen(true);
          }}
        >
          Editar parcela
        </button>
      ) : null}
      <FinanceModal
        open={settleOpen}
        ariaLabel="Baixa da parcela"
        title="Baixar parcela"
        description="Informe os dados da baixa manual desta parcela."
        size="lg"
      >
        <form className={styles.form} style={{ marginTop: 12 }} onSubmit={settleDetailed}>
              <div className={styles.row3}>
                <label className={styles.label}>
                  <span>Data da baixa</span>
                  <input
                    className={styles.filterInput}
                    type="date"
                    value={settleForm.paidAt}
                    onChange={(e) => setSettleForm((p) => ({ ...p, paidAt: e.target.value }))}
                    required
                  />
                </label>
                <label className={styles.label}>
                  <span>Valor pago (R$)</span>
                  <input
                    className={styles.filterInput}
                    value={settleForm.paidAmountBRL}
                    onChange={(e) => setSettleForm((p) => ({ ...p, paidAmountBRL: e.target.value }))}
                    inputMode="decimal"
                    required
                  />
                </label>
                <label className={styles.label}>
                  <span>Forma de pagamento</span>
                  <UISelect
                    className={styles.filterSelect}
                    value={settleForm.paymentMethod}
                    onChange={(value) => setSettleForm((p) => ({ ...p, paymentMethod: value }))}
                    ariaLabel="Forma de pagamento"
                    options={[
                      { value: '', label: 'Selecione' },
                      { value: 'PIX', label: 'PIX' },
                      { value: 'BANK_TRANSFER', label: 'Transferência' },
                      { value: 'CARD', label: 'Cartão' },
                      { value: 'CASH', label: 'Dinheiro' },
                      { value: 'OTHER', label: 'Outro' },
                    ]}
                  />
                </label>
              </div>

              <div className={styles.row3}>
                <label className={styles.label}>
                  <span>Desconto (R$)</span>
                  <input
                    className={styles.filterInput}
                    value={settleForm.discountBRL}
                    onChange={(e) => setSettleForm((p) => ({ ...p, discountBRL: e.target.value }))}
                    inputMode="decimal"
                  />
                </label>
                <label className={styles.label}>
                  <span>Juros (R$)</span>
                  <input
                    className={styles.filterInput}
                    value={settleForm.interestBRL}
                    onChange={(e) => setSettleForm((p) => ({ ...p, interestBRL: e.target.value }))}
                    inputMode="decimal"
                  />
                </label>
                <label className={styles.label}>
                  <span>Multa (R$)</span>
                  <input
                    className={styles.filterInput}
                    value={settleForm.fineBRL}
                    onChange={(e) => setSettleForm((p) => ({ ...p, fineBRL: e.target.value }))}
                    inputMode="decimal"
                  />
                </label>
              </div>

              <div className={styles.row}>
                <label className={styles.label}>
                  <span>Conta da baixa (opcional)</span>
                  <UISelect
                    className={styles.filterSelect}
                    value={settleForm.accountId}
                    onChange={(value) => setSettleForm((p) => ({ ...p, accountId: value }))}
                    ariaLabel="Conta da baixa"
                    loading={accountsLoading}
                    options={[
                      { value: '', label: 'Usar conta padrão do lançamento' },
                      ...accounts.map((a) => ({ value: a.id, label: a.name })),
                    ]}
                  />
                </label>
                <label className={styles.label}>
                  <span>Observações</span>
                  <input
                    className={styles.filterInput}
                    value={settleForm.notes}
                    onChange={(e) => setSettleForm((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="Opcional"
                  />
                </label>
              </div>

              <FinanceModalError message={settleError} />

              <FinanceModalActions>
                <button type="submit" className={styles.smallBtn} disabled={saving}>
                  {saving ? 'Salvando...' : 'Confirmar baixa'}
                </button>
                <button type="button" className={styles.smallBtn} disabled={saving} onClick={() => setSettleOpen(false)}>
                  Fechar
                </button>
              </FinanceModalActions>
        </form>
      </FinanceModal>
      <FinanceModal
        open={editOpen}
        ariaLabel="Editar parcela"
        title={`Editar parcela ${installment.number ? `#${installment.number}` : ''}`}
        description="Ajuste vencimento e descrição antes da baixa."
      >
        <form className={styles.form} style={{ marginTop: 12 }} onSubmit={updateInstallment}>
              <div className={styles.row}>
                <label className={styles.label}>
                  <span>Vencimento</span>
                  <input
                    className={styles.filterInput}
                    type="date"
                    value={editForm.dueDate}
                    onChange={(e) => setEditForm((p) => ({ ...p, dueDate: e.target.value }))}
                    required
                  />
                </label>
                <label className={styles.label}>
                  <span>Descrição da parcela (opcional)</span>
                  <input
                    className={styles.filterInput}
                    value={editForm.description}
                    onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Usa descrição do lançamento se vazio"
                  />
                </label>
              </div>

              <FinanceModalError message={editError} />

              <FinanceModalActions>
                <button type="submit" className={styles.smallBtn} disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar parcela'}
                </button>
                <button type="button" className={styles.smallBtn} disabled={saving} onClick={() => setEditOpen(false)}>
                  Fechar
                </button>
              </FinanceModalActions>
        </form>
      </FinanceModal>
      <FinanceModal
        open={cancelOpen}
        ariaLabel="Cancelar parcela"
        title={`Cancelar parcela ${installment.number ? `#${installment.number}` : ''}`}
        description="Informe o motivo do cancelamento. Esta ação será registrada na auditoria."
      >
        <form className={styles.form} style={{ marginTop: 12 }} onSubmit={submitCancelInstallment}>
              <label className={styles.label}>
                <span>Motivo do cancelamento</span>
                <textarea
                  className={`${styles.filterInput} ${styles.textarea}`}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Obrigatório"
                  required
                />
              </label>

              <FinanceModalError message={cancelError} />

              <FinanceModalActions>
                <button type="submit" className={`${styles.smallBtn} ${styles.smallBtnDanger}`} disabled={saving}>
                  {saving ? 'Cancelando...' : 'Confirmar cancelamento'}
                </button>
                <button
                  type="button"
                  className={styles.smallBtn}
                  disabled={saving}
                  onClick={() => {
                    setCancelOpen(false);
                    setCancelError('');
                  }}
                >
                  Fechar
                </button>
              </FinanceModalActions>
        </form>
      </FinanceModal>
    </div>
  );
}

export function FinanceEntryCancelButton({ entryId }: { entryId: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  async function onCancel(e?: React.FormEvent) {
    e?.preventDefault();
    if (saving) return;
    const text = reason.trim();
    if (!text) {
      setError('Motivo do cancelamento é obrigatório');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const resp = await fetch(`/api/finance/entries/${entryId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: text }),
      });
      if (!resp.ok) throw new Error(await resp.text().catch(() => 'Erro ao cancelar'));
      setOpen(false);
      setReason('');
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={`${styles.smallBtn} ${styles.smallBtnDanger}`}
        disabled={saving}
        onClick={() => {
          setOpen(true);
          setError('');
        }}
      >
        {saving ? 'Cancelando...' : 'Cancelar lançamento'}
      </button>
      <FinanceModal
        open={open}
        ariaLabel="Cancelar lançamento"
        title="Cancelar lançamento"
        description="Informe o motivo do cancelamento. Parcelas abertas/vencidas serão canceladas."
      >
        <form className={styles.form} style={{ marginTop: 12 }} onSubmit={onCancel}>
              <label className={styles.label}>
                <span>Motivo do cancelamento</span>
                <textarea
                  className={`${styles.filterInput} ${styles.textarea}`}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Obrigatório"
                  required
                />
              </label>
              <FinanceModalError message={error} />
              <FinanceModalActions>
                <button type="submit" className={`${styles.smallBtn} ${styles.smallBtnDanger}`} disabled={saving}>
                  {saving ? 'Cancelando...' : 'Confirmar cancelamento'}
                </button>
                <button
                  type="button"
                  className={styles.smallBtn}
                  disabled={saving}
                  onClick={() => {
                    setOpen(false);
                    setError('');
                  }}
                >
                  Fechar
                </button>
              </FinanceModalActions>
        </form>
      </FinanceModal>
    </>
  );
}
