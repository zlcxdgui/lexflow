'use client';

import { useEffect, useMemo, useState } from 'react';
import { AccessDeniedView } from '@/components/AccessDeniedView';
import { BackButton } from '@/components/BackButton';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { UISelect } from '@/components/ui/Select';
import styles from '../calculators.module.css';

type BaseMode = 'PERCENTUAL_RENDA' | 'VALOR_FIXO';
type Indexer = 'FIXO' | 'IPCA' | 'IPCAE' | 'IPCA15' | 'INPC' | 'IGPM' | 'SELIC';
type AmortizationMode = 'NONE' | 'SAC' | 'PRICE';
type TribunalPreset = 'SAJ_PADRAO' | 'TJSP' | 'TJRJ' | 'TJMG' | 'TJMS' | 'TRF';
type PresetVersion = {
  version: string;
  validFrom: string;
  validTo: string | null;
  indexer: Indexer;
  interestMonthly: number;
  fine: number;
  fees: number;
  legalBasis: string[];
  note: string;
};

const PRESET_RULES: Record<TribunalPreset, PresetVersion[]> = {
  SAJ_PADRAO: [
    {
      version: 'v1',
      validFrom: '2024-01-01',
      validTo: null,
      indexer: 'IPCAE',
      interestMonthly: 1,
      fine: 10,
      fees: 10,
      legalBasis: [
        'CPC art. 523 (multa e honorários de 10%)',
        'CC art. 406 (juros moratórios conforme taxa legal aplicável)',
      ],
      note: 'Preset operacional padrão para execução de alimentos.',
    },
  ],
  TJSP: [
    {
      version: 'v1',
      validFrom: '2024-01-01',
      validTo: null,
      indexer: 'IPCAE',
      interestMonthly: 1,
      fine: 10,
      fees: 10,
      legalBasis: ['CPC art. 523', 'Entendimento majoritário TJSP em execuções cíveis'],
      note: 'Padrão usual em cálculos de cumprimento de sentença.',
    },
  ],
  TJRJ: [
    {
      version: 'v1',
      validFrom: '2024-01-01',
      validTo: null,
      indexer: 'IPCA',
      interestMonthly: 1,
      fine: 10,
      fees: 10,
      legalBasis: ['CPC art. 523', 'Parâmetro operacional com IPCA para atualização'],
      note: 'Recomendado validar com contador judicial local.',
    },
  ],
  TJMG: [
    {
      version: 'v1',
      validFrom: '2024-01-01',
      validTo: null,
      indexer: 'INPC',
      interestMonthly: 1,
      fine: 10,
      fees: 10,
      legalBasis: ['CPC art. 523', 'Uso recorrente de INPC em títulos de trato sucessivo'],
      note: 'Ajustável por determinação expressa do juízo.',
    },
  ],
  TJMS: [
    {
      version: 'v1',
      validFrom: '1900-01-01',
      validTo: '2024-08-31',
      indexer: 'IPCAE',
      interestMonthly: 1,
      fine: 10,
      fees: 10,
      legalBasis: [
        'CC art. 406 (redação anterior) c/c CTN art. 161, §1º: 1% a.m. (taxa legal histórica)',
        'CPC art. 523 (multa e honorários de 10%)',
        'Lei 14.905/2024: regra nova com produção integral após vacatio de 60 dias',
      ],
      note: 'Faixa histórica anterior à vigência da Lei 14.905/2024.',
    },
    {
      version: 'v2',
      validFrom: '2024-09-01',
      validTo: null,
      indexer: 'IPCA',
      interestMonthly: 0.9,
      fine: 10,
      fees: 10,
      legalBasis: [
        'Lei 14.905/2024 (alterações dos arts. 389 e 406 do CC)',
        'Taxa legal após 08/08/2024: referência SELIC deduzido IPCA',
        'CPC art. 523 (multa e honorários de 10%)',
      ],
      note: 'Preset operacional pós-Lei 14.905/2024 para uso no TJMS.',
    },
  ],
  TRF: [
    {
      version: 'v1',
      validFrom: '2024-01-01',
      validTo: null,
      indexer: 'SELIC',
      interestMonthly: 0.9,
      fine: 10,
      fees: 10,
      legalBasis: ['CC art. 406', 'Lei 14.905/2024 (taxa legal)'],
      note: 'Preset referencial para demandas com regime federal.',
    },
  ],
};

type PaymentRow = {
  id: string;
  date: string;
  amount: number;
  note: string;
};

type DebtLine = {
  competenceLabel: string;
  dueDate: string;
  principal: number;
  correction: number;
  interest: number;
  fine: number;
  gross: number;
  paid: number;
  balance: number;
};

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function brl(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function toDate(iso: string) {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateBR(iso: string) {
  const d = toDate(iso);
  return d ? d.toLocaleDateString('pt-BR') : '-';
}

function monthDiff(from: Date, to: Date) {
  return Math.max(
    0,
    (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()),
  );
}

function indexMonthlyRate(indexer: Indexer) {
  switch (indexer) {
    case 'FIXO':
      return 0;
    case 'IPCA':
      return 0.0045;
    case 'IPCAE':
      return 0.0048;
    case 'IPCA15':
      return 0.0044;
    case 'INPC':
      return 0.0042;
    case 'IGPM':
      return 0.0051;
    case 'SELIC':
      return 0.0062;
    default:
      return 0.0048;
  }
}

function toCsvCell(v: string | number) {
  const s = String(v ?? '');
  return `"${s.replace(/"/g, '""')}"`;
}

function createMonthlyRange(start: Date, end: Date) {
  const result: Date[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const final = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor.getTime() <= final.getTime()) {
    result.push(new Date(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return result;
}

function getPresetVersion(preset: TribunalPreset, baseDateIso: string): PresetVersion {
  const versions = PRESET_RULES[preset] || PRESET_RULES.SAJ_PADRAO;
  const target = baseDateIso || new Date().toISOString().slice(0, 10);
  const found = versions.find((item) => {
    if (target < item.validFrom) return false;
    if (item.validTo && target > item.validTo) return false;
    return true;
  });
  return found || versions[versions.length - 1];
}

const UFS = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
] as const;

export default function ChildSupportCalculatorPage() {
  const [canReadCalculator, setCanReadCalculator] = useState<boolean | null>(null);
  const [description, setDescription] = useState('');
  const [uf, setUf] = useState('MS');
  const [tribunalPreset, setTribunalPreset] = useState<TribunalPreset>('TJMS');
  const [baseMode, setBaseMode] = useState<BaseMode>('PERCENTUAL_RENDA');
  const [income, setIncome] = useState(0);
  const [percent, setPercent] = useState(30);
  const [fixedAmount, setFixedAmount] = useState(1500);
  const [childrenCount, setChildrenCount] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dueDay, setDueDay] = useState(10);
  const [indexer, setIndexer] = useState<Indexer>('IPCAE');
  const [monthlyInterestPercent, setMonthlyInterestPercent] = useState(1);
  const [finePercent, setFinePercent] = useState(2);
  const [include13, setInclude13] = useState(false);
  const [includeVacationThird, setIncludeVacationThird] = useState(false);
  const [extraMonthlyCost, setExtraMonthlyCost] = useState(0);
  const [feesPercent, setFeesPercent] = useState(10);
  const [amortizationMode, setAmortizationMode] = useState<AmortizationMode>('NONE');
  const [installments, setInstallments] = useState(12);
  const [financingRatePercent, setFinancingRatePercent] = useState(1);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const selectedPresetVersion = useMemo(
    () => getPresetVersion(tribunalPreset, endDate || startDate),
    [tribunalPreset, endDate, startDate],
  );

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const resp = await fetch('/api/auth/me', { cache: 'no-store' });
        if (!resp.ok) {
          if (active) setCanReadCalculator(false);
          return;
        }
        const me = (await resp.json().catch(() => ({}))) as { permissions?: string[] };
        const permissions = Array.isArray(me?.permissions) ? me.permissions : [];
        if (active) setCanReadCalculator(permissions.includes('calculator.read'));
      } catch {
        if (active) setCanReadCalculator(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const result = useMemo(() => {
    const start = toDate(startDate);
    const end = toDate(endDate);
    if (!start || !end || end.getTime() < start.getTime()) {
      return {
        lines: [] as DebtLine[],
        totalGross: 0,
        totalPaid: 0,
        totalOpen: 0,
        fees: 0,
        finalTotal: 0,
        installmentPlan: [] as Array<{ num: number; principal: number; interest: number; total: number }>,
      };
    }

    const children = Math.max(1, Number(childrenCount) || 1);
    const baseMonthly =
      baseMode === 'PERCENTUAL_RENDA'
        ? Math.max(0, income) * (Math.max(0, percent) / 100)
        : Math.max(0, fixedAmount);
    const monthlyBaseWithExtras = baseMonthly + Math.max(0, extraMonthlyCost);
    const correctionRate = indexMonthlyRate(indexer);
    const monthlyInterestRate = Math.max(0, monthlyInterestPercent) / 100;
    const fineRate = Math.max(0, finePercent) / 100;

    const months = createMonthlyRange(start, end);
    const preLines = months.map((m) => {
      const y = m.getFullYear();
      const mo = m.getMonth();
      const due = new Date(y, mo, Math.min(28, Math.max(1, dueDay)));
      const dueIso = due.toISOString().slice(0, 10);
      const monthsLate = monthDiff(due, end);
      let principal = monthlyBaseWithExtras;
      if (include13 && mo === 11) principal += baseMonthly;
      if (includeVacationThird && mo === 0) principal += baseMonthly / 3;

      const correction = principal * (Math.pow(1 + correctionRate, monthsLate) - 1);
      const fine = monthsLate > 0 ? principal * fineRate : 0;
      const basis = principal + correction + fine;
      const interest = basis * monthlyInterestRate * monthsLate;
      const gross = principal + correction + fine + interest;

      return {
        competenceLabel: m.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }),
        dueDate: dueIso,
        principal,
        correction,
        interest,
        fine,
        gross,
      };
    });

    const paymentPool = payments
      .filter((p) => Number(p.amount) > 0 && toDate(p.date) && (toDate(p.date) as Date).getTime() <= end.getTime())
      .reduce((acc, p) => acc + Number(p.amount), 0);

    let remaining = paymentPool;
    const lines: DebtLine[] = preLines.map((line) => {
      const paid = Math.min(line.gross, Math.max(0, remaining));
      remaining -= paid;
      const balance = Math.max(0, line.gross - paid);
      return { ...line, paid, balance };
    });

    const totalGross = lines.reduce((acc, l) => acc + l.gross, 0);
    const totalPaid = lines.reduce((acc, l) => acc + l.paid, 0);
    const totalOpen = lines.reduce((acc, l) => acc + l.balance, 0);
    const fees = totalOpen * (Math.max(0, feesPercent) / 100);
    const finalTotal = totalOpen + fees;

    const installmentPlan: Array<{ num: number; principal: number; interest: number; total: number }> = [];
    if (amortizationMode !== 'NONE' && finalTotal > 0) {
      const n = Math.max(1, Number(installments) || 1);
      const r = Math.max(0, financingRatePercent) / 100;
      if (amortizationMode === 'SAC') {
        let saldo = finalTotal;
        const amort = finalTotal / n;
        for (let i = 1; i <= n; i += 1) {
          const juros = saldo * r;
          const principalPart = Math.min(saldo, amort);
          const total = principalPart + juros;
          installmentPlan.push({ num: i, principal: principalPart, interest: juros, total });
          saldo = Math.max(0, saldo - principalPart);
        }
      } else {
        const parcela =
          r > 0 ? finalTotal * ((r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)) : finalTotal / n;
        let saldo = finalTotal;
        for (let i = 1; i <= n; i += 1) {
          const juros = saldo * r;
          const principalPart = Math.min(saldo, Math.max(0, parcela - juros));
          const total = principalPart + juros;
          installmentPlan.push({ num: i, principal: principalPart, interest: juros, total });
          saldo = Math.max(0, saldo - principalPart);
        }
      }
    }

    // only informational
    void children;

    return { lines, totalGross, totalPaid, totalOpen, fees, finalTotal, installmentPlan };
  }, [
    amortizationMode,
    baseMode,
    childrenCount,
    dueDay,
    endDate,
    extraMonthlyCost,
    feesPercent,
    financingRatePercent,
    fixedAmount,
    income,
    indexer,
    installments,
    monthlyInterestPercent,
    payments,
    percent,
    startDate,
    finePercent,
    include13,
    includeVacationThird,
  ]);

  function addPayment() {
    setPayments((prev) => [...prev, { id: uid(), date: '', amount: 0, note: '' }]);
  }

  function updatePayment(id: string, patch: Partial<PaymentRow>) {
    setPayments((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function removePayment(id: string) {
    setPayments((prev) => prev.filter((p) => p.id !== id));
  }

  function applyTribunalPreset(preset: TribunalPreset) {
    setTribunalPreset(preset);
    const effectiveBase = endDate || startDate || new Date().toISOString().slice(0, 10);
    const rule = getPresetVersion(preset, effectiveBase);
    setIndexer(rule.indexer);
    setMonthlyInterestPercent(rule.interestMonthly);
    setFinePercent(rule.fine);
    setFeesPercent(rule.fees);
    setAmortizationMode('NONE');
  }

  function exportCsv() {
    const header = [
      ['Descrição', description || '-'],
      ['Preset', `${tribunalPreset} ${selectedPresetVersion.version}`],
      ['Fundamento', selectedPresetVersion.legalBasis.join(' | ')],
      ['Data inicial', formatDateBR(startDate)],
      ['Data final', formatDateBR(endDate)],
      ['Total atualizado', result.finalTotal.toFixed(2)],
      [],
      ['Competência', 'Vencimento', 'Principal', 'Correção', 'Multa', 'Juros', 'Total', 'Pago', 'Saldo'],
      ...result.lines.map((line) => [
        line.competenceLabel,
        formatDateBR(line.dueDate),
        line.principal.toFixed(2),
        line.correction.toFixed(2),
        line.fine.toFixed(2),
        line.interest.toFixed(2),
        line.gross.toFixed(2),
        line.paid.toFixed(2),
        line.balance.toFixed(2),
      ]),
    ];
    const csv = header
      .map((row) => row.map((cell) => toCsvCell(cell as string | number)).join(';'))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pensao-saj-${endDate || 'simulacao'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function buildPrintHtml() {
    const rows = result.lines
      .map(
        (line) => `
      <tr>
        <td>${line.competenceLabel}</td>
        <td>${formatDateBR(line.dueDate)}</td>
        <td>${brl(line.principal)}</td>
        <td>${brl(line.correction)}</td>
        <td>${brl(line.fine)}</td>
        <td>${brl(line.interest)}</td>
        <td>${brl(line.gross)}</td>
        <td>${brl(line.paid)}</td>
        <td>${brl(line.balance)}</td>
      </tr>`,
      )
      .join('');

    const installmentsRows = result.installmentPlan
      .map(
        (it) => `
      <tr>
        <td>${it.num}</td>
        <td>${brl(it.principal)}</td>
        <td>${brl(it.interest)}</td>
        <td>${brl(it.total)}</td>
      </tr>`,
      )
      .join('');

    return `
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Memória de cálculo - Pensão alimentícia</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
          h1,h2 { margin: 0 0 10px; }
          p { margin: 3px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
          th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
          th { background: #f5f5f5; }
          .summary { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-top: 10px; }
          .card { border: 1px solid #ddd; padding: 8px; border-radius: 6px; }
        </style>
      </head>
      <body>
        <h1>Calculadora de pensão alimentícia</h1>
        <p><b>UF:</b> ${uf} | <b>Preset:</b> ${tribunalPreset}</p>
        <p><b>Versão do preset:</b> ${selectedPresetVersion.version}</p>
        <p><b>Fundamento:</b> ${selectedPresetVersion.legalBasis.join(' | ')}</p>
        <p><b>Descrição:</b> ${description || '-'}</p>
        <p><b>Período:</b> ${formatDateBR(startDate)} até ${formatDateBR(endDate)}</p>
        <div class="summary">
          <div class="card"><b>Total bruto</b><br/>${brl(result.totalGross)}</div>
          <div class="card"><b>Total pago</b><br/>${brl(result.totalPaid)}</div>
          <div class="card"><b>Total final</b><br/>${brl(result.finalTotal)}</div>
        </div>
        <h2 style="margin-top:16px;">Memória por competência</h2>
        <table>
          <thead>
            <tr><th>Competência</th><th>Vencimento</th><th>Principal</th><th>Correção</th><th>Multa</th><th>Juros</th><th>Total</th><th>Pago</th><th>Saldo</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <h2 style="margin-top:16px;">Parcelamento</h2>
        <table>
          <thead><tr><th>Parcela</th><th>Principal</th><th>Juros</th><th>Total</th></tr></thead>
          <tbody>${installmentsRows || '<tr><td colspan="4">Sem parcelamento</td></tr>'}</tbody>
        </table>
      </body>
      </html>
    `;
  }

  function printReport() {
    const w = window.open('', '_blank', 'width=1200,height=820');
    if (!w) return;
    w.document.open();
    w.document.write(buildPrintHtml());
    w.document.close();
    w.focus();
    w.print();
  }

  async function exportPdf() {
    const payload = {
      description,
      uf,
      preset: tribunalPreset,
      presetVersion: selectedPresetVersion.version,
      legalBasis: selectedPresetVersion.legalBasis.join(' | '),
      startDate,
      endDate,
      totals: {
        totalGross: result.totalGross,
        totalPaid: result.totalPaid,
        totalOpen: result.totalOpen,
        fees: result.fees,
        finalTotal: result.finalTotal,
      },
      lines: result.lines,
    };

    const resp = await fetch('/api/calculators/child-support/pdf', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const text = await resp.text();
      alert(text || 'Não foi possível gerar o PDF.');
      return;
    }

    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `memoria-pensao-${endDate || 'simulacao'}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (canReadCalculator === false) {
    return <AccessDeniedView area="Calculadoras" />;
  }

  return (
    <main className={`${styles.page} appPageShell`}>
      <SectionHeader
        title="Calculadora de pensão alimentícia"
        description="Simulação avançada no estilo SAJ (competências, atualização, juros, multa e amortização)."
        headingAs="h1"
        className={styles.header}
        actions={<BackButton fallbackHref="/dashboard" className={styles.backLink} />}
      />

      <section className={styles.card}>
        <label className={`${styles.field} ${styles.fieldWide}`}>
          <span>Descrição do cálculo</span>
          <textarea
            className={styles.textarea}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex.: Cumprimento de sentença de alimentos"
          />
        </label>
        <div className={styles.actions}>
          <button type="button" className={styles.primaryButton} onClick={exportCsv}>
            Exportar CSV
          </button>
          <button type="button" className={styles.primaryButton} onClick={exportPdf}>
            Exportar PDF
          </button>
          <button type="button" className={styles.secondaryButton} onClick={printReport}>
            Imprimir
          </button>
        </div>
      </section>

      <section className={styles.card}>
        <h3 className={styles.sectionTitle}>Parâmetros do cálculo</h3>
        <div className={styles.grid}>
            <label className={styles.field}>
              <span>UF</span>
              <UISelect
                className={styles.input}
                value={uf}
                onChange={setUf}
                ariaLabel="UF"
                options={UFS.map((itemUf) => ({ value: itemUf, label: itemUf }))}
              />
            </label>
            <label className={styles.field}>
              <span>Preset por tribunal</span>
              <UISelect
                className={styles.input}
                value={tribunalPreset}
                onChange={(value) => applyTribunalPreset(value as TribunalPreset)}
                ariaLabel="Preset por tribunal"
                options={[
                  { value: 'SAJ_PADRAO', label: 'SAJ padrão' },
                  { value: 'TJSP', label: 'TJSP' },
                  { value: 'TJRJ', label: 'TJRJ' },
                  { value: 'TJMG', label: 'TJMG' },
                  { value: 'TJMS', label: 'TJMS' },
                  { value: 'TRF', label: 'TRF' },
                ]}
              />
            </label>
          <label className={styles.field}>
            <span>Data inicial</span>
            <input className={styles.input} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label className={styles.field}>
            <span>Data final (atualização)</span>
            <input className={styles.input} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
          <label className={styles.field}>
            <span>Dia de vencimento</span>
            <input
              className={styles.input}
              type="number"
              min={1}
              max={28}
              step={1}
              value={dueDay}
              onChange={(e) => setDueDay(Math.max(1, Math.min(28, Number(e.target.value) || 1)))}
            />
          </label>

            <label className={styles.field}>
              <span>Base da pensão</span>
              <UISelect
                className={styles.input}
                value={baseMode}
                onChange={(value) => setBaseMode(value as BaseMode)}
                ariaLabel="Base da pensão"
                options={[
                  { value: 'PERCENTUAL_RENDA', label: 'Percentual da renda' },
                  { value: 'VALOR_FIXO', label: 'Valor fixo' },
                ]}
              />
            </label>
          {baseMode === 'PERCENTUAL_RENDA' ? (
            <>
              <label className={styles.field}>
                <span>Renda líquida mensal (R$)</span>
                <input
                  className={styles.input}
                  type="number"
                  min={0}
                  step="0.01"
                  value={income}
                  onChange={(e) => setIncome(Math.max(0, Number(e.target.value) || 0))}
                />
              </label>
              <label className={styles.field}>
                <span>Percentual (%)</span>
                <input
                  className={styles.input}
                  type="number"
                  min={0}
                  step="0.01"
                  value={percent}
                  onChange={(e) => setPercent(Math.max(0, Number(e.target.value) || 0))}
                />
              </label>
            </>
          ) : (
            <label className={styles.field}>
              <span>Valor fixo mensal (R$)</span>
              <input
                className={styles.input}
                type="number"
                min={0}
                step="0.01"
                value={fixedAmount}
                onChange={(e) => setFixedAmount(Math.max(0, Number(e.target.value) || 0))}
              />
            </label>
          )}

          <label className={styles.field}>
            <span>Dependentes</span>
            <input
              className={styles.input}
              type="number"
              min={1}
              step={1}
              value={childrenCount}
              onChange={(e) => setChildrenCount(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>
            <label className={styles.field}>
              <span>Índice de atualização</span>
              <UISelect
                className={styles.input}
                value={indexer}
                onChange={(value) => setIndexer(value as Indexer)}
                ariaLabel="Índice de atualização"
                options={[
                  { value: 'FIXO', label: 'Não atualizar (fixo)' },
                  { value: 'IPCA', label: 'IPCA' },
                  { value: 'IPCAE', label: 'IPCA-E' },
                  { value: 'IPCA15', label: 'IPCA-15' },
                  { value: 'INPC', label: 'INPC' },
                  { value: 'IGPM', label: 'IGP-M' },
                  { value: 'SELIC', label: 'SELIC' },
                ]}
              />
            </label>
          <label className={styles.field}>
            <span>Juros moratórios (% ao mês)</span>
            <input
              className={styles.input}
              type="number"
              min={0}
              step="0.01"
              value={monthlyInterestPercent}
              onChange={(e) => setMonthlyInterestPercent(Math.max(0, Number(e.target.value) || 0))}
            />
          </label>
          <label className={styles.field}>
            <span>Multa (%)</span>
            <input
              className={styles.input}
              type="number"
              min={0}
              step="0.01"
              value={finePercent}
              onChange={(e) => setFinePercent(Math.max(0, Number(e.target.value) || 0))}
            />
          </label>
          <label className={styles.field}>
            <span>Honorários (%)</span>
            <input
              className={styles.input}
              type="number"
              min={0}
              step="0.01"
              value={feesPercent}
              onChange={(e) => setFeesPercent(Math.max(0, Number(e.target.value) || 0))}
            />
          </label>
          <label className={styles.field}>
            <span>Despesas extras mensais (R$)</span>
            <input
              className={styles.input}
              type="number"
              min={0}
              step="0.01"
              value={extraMonthlyCost}
              onChange={(e) => setExtraMonthlyCost(Math.max(0, Number(e.target.value) || 0))}
            />
          </label>
        </div>
        <div className={styles.muted}>
          Preset ativo: <strong>{tribunalPreset}</strong> ({selectedPresetVersion.version}) · Vigência:{' '}
          {formatDateBR(selectedPresetVersion.validFrom)}{' '}
          {selectedPresetVersion.validTo ? `até ${formatDateBR(selectedPresetVersion.validTo)}` : 'em aberto'}
        </div>
        <div className={styles.muted}>
          Fundamento jurídico: {selectedPresetVersion.legalBasis.join(' | ')}
        </div>
        <div className={styles.muted}>{selectedPresetVersion.note}</div>
        <div className={styles.actions}>
          <label className={`${styles.secondaryButton} ${styles.checkboxButton}`}>
            <input type="checkbox" checked={include13} onChange={(e) => setInclude13(e.target.checked)} />
            <span>Incluir 13º</span>
          </label>
          <label className={`${styles.secondaryButton} ${styles.checkboxButton}`}>
            <input
              type="checkbox"
              checked={includeVacationThird}
              onChange={(e) => setIncludeVacationThird(e.target.checked)}
            />
            <span>Incluir férias (1/3)</span>
          </label>
        </div>
        <div className={styles.muted}>
          Legenda: <strong>Incluir 13º</strong> adiciona uma competência extra no mês de dezembro.{' '}
          <strong>Incluir férias (1/3)</strong> adiciona 1/3 do valor base em janeiro.
        </div>
      </section>

      <section className={styles.card}>
        <h3 className={styles.sectionTitle}>Pagamentos (amortização por abatimento)</h3>
        <div className={styles.actions}>
          <button type="button" className={styles.primaryButton} onClick={addPayment}>
            Adicionar pagamento
          </button>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Data</th>
                <th>Valor</th>
                <th>Observação</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {payments.length ? (
                payments.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <input className={styles.input} type="date" value={p.date} onChange={(e) => updatePayment(p.id, { date: e.target.value })} />
                    </td>
                    <td>
                      <input
                        className={styles.input}
                        type="number"
                        min={0}
                        step="0.01"
                        value={p.amount}
                        onChange={(e) => updatePayment(p.id, { amount: Math.max(0, Number(e.target.value) || 0) })}
                      />
                    </td>
                    <td>
                      <input className={styles.input} value={p.note} onChange={(e) => updatePayment(p.id, { note: e.target.value })} />
                    </td>
                    <td>
                      <button type="button" className={styles.secondaryButton} onClick={() => removePayment(p.id)}>
                        Remover
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className={styles.muted}>
                    Nenhum pagamento informado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.card}>
        <h3 className={styles.sectionTitle}>Resumo</h3>
        <div className={styles.resultGrid}>
          <article className={styles.kpi}>
            <span>Total atualizado bruto</span>
            <strong>{brl(result.totalGross)}</strong>
          </article>
          <article className={styles.kpi}>
            <span>Total pago</span>
            <strong>{brl(result.totalPaid)}</strong>
          </article>
          <article className={styles.kpi}>
            <span>Saldo aberto</span>
            <strong>{brl(result.totalOpen)}</strong>
          </article>
        </div>
        <div className={styles.resultGrid}>
          <article className={styles.kpi}>
            <span>Honorários</span>
            <strong>{brl(result.fees)}</strong>
          </article>
          <article className={styles.kpi}>
            <span>Total final</span>
            <strong>{brl(result.finalTotal)}</strong>
          </article>
          <article className={styles.kpi}>
            <span>Amortização</span>
            <strong>
              {amortizationMode === 'NONE' ? 'Sem parcelamento' : amortizationMode}
            </strong>
          </article>
        </div>
      </section>

      <section className={styles.card}>
        <h3 className={styles.sectionTitle}>Memória de cálculo por competência</h3>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Competência</th>
                <th>Vencimento</th>
                <th>Principal</th>
                <th>Correção</th>
                <th>Multa</th>
                <th>Juros</th>
                <th>Total</th>
                <th>Pago</th>
                <th>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {result.lines.length ? (
                result.lines.map((line) => (
                  <tr key={`${line.competenceLabel}-${line.dueDate}`}>
                    <td>{line.competenceLabel}</td>
                    <td>{formatDateBR(line.dueDate)}</td>
                    <td>{brl(line.principal)}</td>
                    <td>{brl(line.correction)}</td>
                    <td>{brl(line.fine)}</td>
                    <td>{brl(line.interest)}</td>
                    <td>{brl(line.gross)}</td>
                    <td>{brl(line.paid)}</td>
                    <td>{brl(line.balance)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className={styles.muted}>
                    Informe data inicial e data final para gerar a memória.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.card}>
        <h3 className={styles.sectionTitle}>Parcelamento do saldo (SAC/PRICE)</h3>
        <div className={styles.grid}>
            <label className={styles.field}>
              <span>Tipo de amortização</span>
              <UISelect
                className={styles.input}
                value={amortizationMode}
                onChange={(value) => setAmortizationMode(value as AmortizationMode)}
                ariaLabel="Tipo de amortização"
                options={[
                  { value: 'NONE', label: 'Sem parcelamento' },
                  { value: 'SAC', label: 'SAC' },
                  { value: 'PRICE', label: 'PRICE' },
                ]}
              />
            </label>
          <label className={styles.field}>
            <span>Quantidade de parcelas</span>
            <input
              className={styles.input}
              type="number"
              min={1}
              step={1}
              value={installments}
              onChange={(e) => setInstallments(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>
          <label className={styles.field}>
            <span>Juros do parcelamento (% ao mês)</span>
            <input
              className={styles.input}
              type="number"
              min={0}
              step="0.01"
              value={financingRatePercent}
              onChange={(e) => setFinancingRatePercent(Math.max(0, Number(e.target.value) || 0))}
            />
          </label>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Parcela</th>
                <th>Principal</th>
                <th>Juros</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {result.installmentPlan.length ? (
                result.installmentPlan.map((it) => (
                  <tr key={it.num}>
                    <td>{it.num}</td>
                    <td>{brl(it.principal)}</td>
                    <td>{brl(it.interest)}</td>
                    <td>{brl(it.total)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className={styles.muted}>
                    Selecione SAC ou PRICE para simular parcelamento do saldo final.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
