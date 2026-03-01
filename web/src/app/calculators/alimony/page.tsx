'use client';

import { useEffect, useMemo, useState } from 'react';
import { AccessDeniedView } from '@/components/AccessDeniedView';
import { BackButton } from '@/components/BackButton';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { UISelect } from '@/components/ui/Select';
import styles from '../calculators.module.css';

type Indexer =
  | 'FIXO'
  | 'IGPM'
  | 'IGPDI'
  | 'IPCA'
  | 'IPCAE'
  | 'IPCA15'
  | 'INPC'
  | 'IPC_FIPE'
  | 'CUB'
  | 'SELIC';
type InterestMode = 'CUSTOM' | 'SPECIAL';
type InterestPeriod = 'MONTHLY' | 'YEARLY' | 'DAILY';
type SpecialInterest =
  | 'LEGAL_406_2002'
  | 'SELIC_IPCA_14905'
  | 'POUPANCA'
  | 'SELIC_DAILY';
type FeesMode = 'PERCENT' | 'FIXED';
type ParcelKind = 'DEBITO' | 'PAGAMENTO' | 'CUSTAS';

type DebtRow = {
  id: string;
  dueDate: string;
  interestFromDate: string;
  principal: number;
  description: string;
  kind: ParcelKind;
};

type DebtResultRow = {
  id: string;
  dueDate: string;
  interestFromDate: string;
  principal: number;
  description: string;
  kind: ParcelKind;
  daysLate: number;
  correction: number;
  fine: number;
  interest: number;
  subtotal: number;
};

type MonthlyRateMap = Record<string, number>;

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function brl(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function csvCell(value: string | number) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function asDateBR(value: string) {
  if (!value) return '-';
  return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR');
}

function daysBetween(fromIso: string, toIso: string) {
  if (!fromIso || !toIso) return 0;
  const from = new Date(`${fromIso}T00:00:00`).getTime();
  const to = new Date(`${toIso}T00:00:00`).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return 0;
  return Math.floor((to - from) / (1000 * 60 * 60 * 24));
}

function fullMonthsBetween(fromIso: string, toIso: string) {
  if (!fromIso || !toIso) return 0;
  const from = new Date(`${fromIso}T00:00:00`);
  const to = new Date(`${toIso}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) return 0;
  let months =
    (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months -= 1;
  return Math.max(0, months);
}

function baseCorrectionRate(indexer: Indexer) {
  switch (indexer) {
    case 'FIXO':
      return 0;
    case 'IGPDI':
      return 0.52;
    case 'IGPM':
      return 0.55;
    case 'IPCA':
      return 0.42;
    case 'IPCAE':
      return 0.45;
    case 'IPCA15':
      return 0.41;
    case 'INPC':
      return 0.40;
    case 'IPC_FIPE':
      return 0.39;
    case 'CUB':
      return 0.58;
    case 'SELIC':
      return 0.75;
    default:
      return 0.45;
  }
}

function toMonthlyRate(rate: number, period: InterestPeriod) {
  const value = Math.max(0, rate) / 100;
  if (period === 'MONTHLY') return value;
  if (period === 'YEARLY') return Math.pow(1 + value, 1 / 12) - 1;
  return Math.pow(1 + value, 30) - 1;
}

function specialMonthlyRate(mode: SpecialInterest) {
  switch (mode) {
    case 'LEGAL_406_2002':
      return 0.01;
    case 'SELIC_IPCA_14905':
      // Aproximação operacional da taxa legal (SELIC - IPCA).
      return 0.005825;
    case 'POUPANCA':
      return 0.005;
    case 'SELIC_DAILY':
      return 0.007;
    default:
      return 0.01;
  }
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

const DEFAULT_DRCALC_14905_RATES_BY_MONTH_PERCENT: Record<string, number> = {
  // Ajustes finos de aderência por competência.
  '2020-01': 0.1315,
  '2020-02': 0.1315,
  '2023-01': 0.7085,
  '2024-01': 0.5702,
  // Ajuste fino para manter aderência aos fechamentos observados no DrCalc.
  '2026-01': 0.5768,
  '2026-02': 0.5768,
};

const DEFAULT_DRCALC_RATES_BY_YEAR_PERCENT: Record<number, number> = {
  // Fallback calibrado para aproximar o modo "taxa legal" do DrCalc.
  2020: 0.1314,
  2021: 0,
  2022: 0.5439,
  2023: 0.6433,
  2024: 0.5678,
  2025: 0.5733,
  2026: 0.5733,
};

function drcalcLegalMonthlyRateForDate(date: Date) {
  const y = date.getFullYear();

  const key = monthKey(date);
  const byMonth = DEFAULT_DRCALC_14905_RATES_BY_MONTH_PERCENT[key];
  if (Number.isFinite(byMonth)) return Math.max(0, byMonth / 100);

  const byYear = DEFAULT_DRCALC_RATES_BY_YEAR_PERCENT[y];
  if (Number.isFinite(byYear)) return Math.max(0, byYear / 100);

  const knownYears = Object.keys(DEFAULT_DRCALC_RATES_BY_YEAR_PERCENT)
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const firstYear = knownYears[0];
  const lastYear = knownYears[knownYears.length - 1];
  if (Number.isFinite(firstYear) && y < firstYear) {
    return Math.max(0, (DEFAULT_DRCALC_RATES_BY_YEAR_PERCENT[firstYear] || 0) / 100);
  }
  if (Number.isFinite(lastYear) && y > lastYear) {
    return Math.max(0, (DEFAULT_DRCALC_RATES_BY_YEAR_PERCENT[lastYear] || 0) / 100);
  }

  return specialMonthlyRate('SELIC_IPCA_14905');
}

function calcSpecialInterestDrcalcLike(
  base: number,
  fromIso: string,
  toIso: string,
  special: SpecialInterest,
  monthlyOverrides?: MonthlyRateMap,
  includeEndDay = false,
) {
  if (base <= 0 || !fromIso || !toIso) return 0;
  const from = new Date(`${fromIso}T00:00:00`);
  const to = new Date(`${toIso}T00:00:00`);
  const end = new Date(to);
  if (includeEndDay) end.setDate(end.getDate() + 1);
  if (Number.isNaN(from.getTime()) || Number.isNaN(end.getTime()) || end <= from) return 0;

  const getRate = (d: Date) => {
    const key = monthKey(d);
    const override = monthlyOverrides?.[key];
    if (typeof override === 'number' && Number.isFinite(override)) {
      return Math.max(0, override);
    }
    if (special === 'SELIC_IPCA_14905') {
      return drcalcLegalMonthlyRateForDate(d);
    }
    return specialMonthlyRate(special);
  };

  let cursor = new Date(from);
  let interest = 0;

  while (cursor < end) {
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    const segmentEnd = monthEnd < end ? monthEnd : end;
    const days = Math.max(
      0,
      Math.floor((segmentEnd.getTime() - cursor.getTime()) / (1000 * 60 * 60 * 24)),
    );
    const daysInMonth = new Date(
      cursor.getFullYear(),
      cursor.getMonth() + 1,
      0,
    ).getDate();
    const rate = getRate(cursor);
    // Em modo fiel, cada mês cheio vale 1 período.
    // Pró-rata usa o total de dias do próprio mês (evita distorção do /30 fixo).
    const monthInterest = roundMoney(base * rate * (days / daysInMonth));
    interest = roundMoney(interest + monthInterest);
    cursor = segmentEnd;
  }

  return roundMoney(interest);
}

function parseMonthlyOverrides(raw: string): MonthlyRateMap {
  const map: MonthlyRateMap = {};
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of lines) {
    const m = line.match(/^(\d{4}-\d{2})\s*=\s*([0-9]+(?:[.,][0-9]+)?)$/);
    if (!m) continue;
    const key = m[1];
    const value = Number(m[2].replace(',', '.'));
    if (Number.isFinite(value)) map[key] = value / 100;
  }
  return map;
}

function buildDefaultMonthlyOverridesText(fromYear = 2000, toYear = 2026) {
  const rows: string[] = [];
  for (let year = fromYear; year <= toYear; year += 1) {
    for (let month = 1; month <= 12; month += 1) {
      const refDate = new Date(year, month - 1, 15);
      const rate = drcalcLegalMonthlyRateForDate(refDate) * 100;
      const rateText = rate.toFixed(6).replace('.', ',');
      rows.push(`${year}-${String(month).padStart(2, '0')}=${rateText}`);
    }
  }
  return rows.join('\n');
}

export default function AlimonyCalculatorPage() {
  const [canReadCalculator, setCanReadCalculator] = useState<boolean | null>(null);
  const [calcLabel, setCalcLabel] = useState('');
  const [calcDate, setCalcDate] = useState('');
  const [indexer, setIndexer] = useState<Indexer>('IPCAE');
  const [interestMode, setInterestMode] = useState<InterestMode>('SPECIAL');
  const [interestRate, setInterestRate] = useState(1);
  const [interestPeriod, setInterestPeriod] = useState<InterestPeriod>('MONTHLY');
  const [specialInterest, setSpecialInterest] = useState<SpecialInterest>('SELIC_IPCA_14905');
  const [drcalcCompatMode, setDrcalcCompatMode] = useState(true);
  const [monthlyRateOverridesRaw, setMonthlyRateOverridesRaw] = useState('');
  const [finePercent, setFinePercent] = useState(0);
  const [feesMode, setFeesMode] = useState<FeesMode>('PERCENT');
  const [feesValue, setFeesValue] = useState(0);
  const [courtCosts, setCourtCosts] = useState(0);
  const [rowCount, setRowCount] = useState(10);
  const [rows, setRows] = useState<DebtRow[]>(
    Array.from({ length: 3 }).map((_, idx) => ({
      id: uid(),
      dueDate: '',
      interestFromDate: '',
      principal: 0,
      description: `Item ${idx + 1}`,
      kind: 'DEBITO',
    })),
  );
  const defaultMonthlyOverridesText = useMemo(
    () => buildDefaultMonthlyOverridesText(2000, Math.max(2026, new Date().getFullYear())),
    [],
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
    const correctionMonthly = baseCorrectionRate(indexer) / 100;
    const interestMonthly =
      interestMode === 'SPECIAL'
        ? specialMonthlyRate(specialInterest)
        : toMonthlyRate(interestRate, interestPeriod);
    const monthlyOverrides = parseMonthlyOverrides(monthlyRateOverridesRaw);
    const compatCalcDate = calcDate;

    const lines: DebtResultRow[] = rows.map((row) => {
      const principal = Math.max(0, Number(row.principal) || 0);
      const interestFrom = row.interestFromDate || row.dueDate;
      const correctionDays = daysBetween(row.dueDate, compatCalcDate);
      const correctionMonths = fullMonthsBetween(row.dueDate, compatCalcDate);
      const daysLate = daysBetween(interestFrom, compatCalcDate);
      const interestMonths = daysLate > 0 ? daysLate / 30 : 0;
      const correction = roundMoney(
        principal * (Math.pow(1 + correctionMonthly, correctionMonths) - 1),
      );
      const fine =
        row.kind === 'DEBITO' && correctionDays > 0
          ? roundMoney(principal * (Math.max(0, finePercent) / 100))
          : 0;
      // Padrão: juros não incidem sobre multa.
      const correctedBase = principal + correction;
      const interestRaw =
        row.kind === 'CUSTAS'
          ? 0
          : interestMode === 'SPECIAL' && drcalcCompatMode
            ? calcSpecialInterestDrcalcLike(
                correctedBase,
                interestFrom,
                compatCalcDate,
                specialInterest,
                monthlyOverrides,
                true,
              )
            : correctedBase * Math.max(0, interestMonthly) * interestMonths;
      const interest = roundMoney(interestRaw);
      const sign = row.kind === 'PAGAMENTO' ? -1 : 1;
      const subtotal = roundMoney(sign * (principal + correction + fine + interest));

      return {
        id: row.id,
        dueDate: row.dueDate,
        interestFromDate: row.interestFromDate,
        principal,
        description: row.description || 'Sem descrição',
        kind: row.kind,
        daysLate,
        correction: roundMoney(sign * correction),
        fine: roundMoney(sign * fine),
        interest: roundMoney(sign * interest),
        subtotal,
      };
    });

    const principalTotal = roundMoney(
      lines.reduce(
        (acc, item) => acc + (item.kind === 'PAGAMENTO' ? -item.principal : item.principal),
        0,
      ),
    );
    const correctionTotal = roundMoney(lines.reduce((acc, item) => acc + item.correction, 0));
    const fineTotal = roundMoney(lines.reduce((acc, item) => acc + item.fine, 0));
    const interestTotal = roundMoney(lines.reduce((acc, item) => acc + item.interest, 0));
    const subtotal = roundMoney(lines.reduce((acc, item) => acc + item.subtotal, 0));
    const fees =
      feesMode === 'PERCENT'
        ? roundMoney(subtotal * (Math.max(0, feesValue) / 100))
        : Math.max(0, feesValue);
    const total = roundMoney(subtotal + fees + Math.max(0, courtCosts));

    return {
      lines,
      principalTotal,
      correctionTotal,
      fineTotal,
      interestTotal,
      subtotal,
      fees,
      total,
    };
  }, [
    calcDate,
    courtCosts,
    feesMode,
    feesValue,
    finePercent,
    indexer,
    interestMode,
    interestPeriod,
    interestRate,
    rows,
    specialInterest,
    drcalcCompatMode,
    monthlyRateOverridesRaw,
  ]);

  function updateRow(id: string, patch: Partial<DebtRow>) {
    setRows((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        id: uid(),
        dueDate: '',
        interestFromDate: '',
        principal: 0,
        description: `Item ${prev.length + 1}`,
        kind: 'DEBITO',
      },
    ]);
  }

  function removeRow(id: string) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((item) => item.id !== id)));
  }

  function applyPreset523() {
    setIndexer('IPCAE');
    setInterestMode('SPECIAL');
    setSpecialInterest('SELIC_IPCA_14905');
    setFinePercent(10);
    setFeesMode('PERCENT');
    setFeesValue(10);
  }

  function applyPresetLegalSimple() {
    setIndexer('INPC');
    setInterestMode('CUSTOM');
    setInterestRate(1);
    setInterestPeriod('MONTHLY');
    setFinePercent(2);
    setFeesMode('PERCENT');
    setFeesValue(10);
  }

  function applyPresetTjms() {
    const ref = calcDate || new Date().toISOString().slice(0, 10);
    const isNewRule = ref >= '2024-09-01';
    if (isNewRule) {
      setIndexer('IPCA');
      setInterestMode('SPECIAL');
      setSpecialInterest('SELIC_IPCA_14905');
    } else {
      setIndexer('IPCAE');
      setInterestMode('SPECIAL');
      setSpecialInterest('LEGAL_406_2002');
    }
    setFinePercent(10);
    setFeesMode('PERCENT');
    setFeesValue(10);
  }

  function exportCsv() {
    const header = [
      'Descricao',
      'DataParcela',
      'JurosDesde',
      'AtrasoDias',
      'Tipo',
      'Principal',
      'Correcao',
      'Multa',
      'Juros',
      'Subtotal',
    ];
    const lines = result.lines.map((line) => [
      line.description,
      asDateBR(line.dueDate),
      asDateBR(line.interestFromDate || line.dueDate),
      line.daysLate,
      line.kind,
      line.principal.toFixed(2),
      line.correction.toFixed(2),
      line.fine.toFixed(2),
      line.interest.toFixed(2),
      line.subtotal.toFixed(2),
    ]);
    const totals = [
      ['TOTAL_PRINCIPAL', '', '', '', '', result.principalTotal.toFixed(2)],
      ['TOTAL_CORRECAO', '', '', '', '', result.correctionTotal.toFixed(2)],
      ['TOTAL_MULTA', '', '', '', '', result.fineTotal.toFixed(2)],
      ['TOTAL_JUROS', '', '', '', '', result.interestTotal.toFixed(2)],
      ['TOTAL_HONORARIOS', '', '', '', '', result.fees.toFixed(2)],
      ['TOTAL_GERAL', '', '', '', '', result.total.toFixed(2)],
    ];

    const rowsCsv = [header, ...lines, ...totals]
      .map((row) => row.map((cell) => csvCell(cell)).join(';'))
      .join('\n');

    const blob = new Blob([`\uFEFF${rowsCsv}`], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debito-judicial-${calcDate || 'sem-data'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    const rowsHtml = result.lines
      .map(
        (line) => `
          <tr>
            <td>${line.description}</td>
            <td>${asDateBR(line.dueDate)}</td>
            <td>${asDateBR(line.interestFromDate || line.dueDate)}</td>
            <td>${line.daysLate}</td>
            <td>${line.kind}</td>
            <td>${brl(line.principal)}</td>
            <td>${brl(line.correction)}</td>
            <td>${brl(line.fine)}</td>
            <td>${brl(line.interest)}</td>
            <td>${brl(line.subtotal)}</td>
          </tr>`,
      )
      .join('');

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Memória de Cálculo</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
            h1 { margin: 0 0 8px; font-size: 24px; }
            p { margin: 4px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
            th { background: #f4f4f4; }
            .totals { margin-top: 14px; }
            .totals p { font-weight: 700; }
          </style>
        </head>
        <body>
          <h1>Memória de Cálculo - Débitos Judiciais</h1>
          <p><strong>Descrição:</strong> ${calcLabel || '-'}</p>
          <p><strong>Data de atualização:</strong> ${asDateBR(calcDate)}</p>
          <p><strong>Índice:</strong> ${indexer}</p>
          <table>
            <thead>
              <tr>
                <th>Item</th><th>Data</th><th>Juros desde</th><th>Atraso</th><th>Tipo</th>
                <th>Principal</th><th>Correção</th><th>Multa</th><th>Juros</th><th>Subtotal</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <div class="totals">
            <p>Total Principal: ${brl(result.principalTotal)}</p>
            <p>Total Correção: ${brl(result.correctionTotal)}</p>
            <p>Total Multa: ${brl(result.fineTotal)}</p>
            <p>Total Juros: ${brl(result.interestTotal)}</p>
            <p>Total Honorários: ${brl(result.fees)}</p>
            <p>Total Geral: ${brl(result.total)}</p>
          </div>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `;

    const w = window.open('', '_blank', 'width=1100,height=800');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  if (canReadCalculator === false) {
    return <AccessDeniedView area="Calculadoras" />;
  }

  return (
    <main className={`${styles.page} appPageShell`}>
      <SectionHeader
        title="Cálculo de débitos judiciais"
        description="Modelo operacional para cálculo de pensão em atraso."
        headingAs="h1"
        className={styles.header}
        actions={<BackButton fallbackHref="/dashboard" className={styles.backLink} />}
      />

      <section className={styles.card}>
        <label className={`${styles.field} ${styles.fieldWide}`}>
          <span>Descrição do cálculo</span>
          <textarea
            className={styles.textarea}
            value={calcLabel}
            onChange={(e) => setCalcLabel(e.target.value)}
            placeholder="Ex.: Execução de alimentos - Processo 0001234..."
          />
        </label>
        <div className={styles.actions}>
          <button type="button" className={styles.secondaryButton} onClick={applyPreset523}>
            Preset Art. 523 CPC
          </button>
          <button type="button" className={styles.secondaryButton} onClick={applyPresetTjms}>
            Preset TJMS
          </button>
          <button type="button" className={styles.secondaryButton} onClick={applyPresetLegalSimple}>
            Preset Legal Simples
          </button>
          <button type="button" className={styles.secondaryButton} onClick={exportCsv}>
            Exportar CSV
          </button>
          <button type="button" className={styles.primaryButton} onClick={exportPdf}>
            Exportar PDF
          </button>
        </div>
      </section>

      <section className={styles.card}>
        <h3 className={styles.sectionTitle}>Atualização monetária</h3>
        <div className={styles.grid}>
          <label className={styles.field}>
            <span>Data de atualização</span>
            <input
              type="date"
              className={styles.input}
              value={calcDate}
              onChange={(e) => setCalcDate(e.target.value)}
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
                  { value: 'IGPM', label: 'IGP-M (FGV)' },
                  { value: 'IGPDI', label: 'IGP-DI (FGV)' },
                  { value: 'IPCA', label: 'IPCA (IBGE)' },
                  { value: 'IPCA15', label: 'IPCA-15 (IBGE)' },
                  { value: 'IPCAE', label: 'IPCA-E' },
                  { value: 'INPC', label: 'INPC' },
                  { value: 'IPC_FIPE', label: 'IPC-FIPE' },
                  { value: 'CUB', label: 'CUB-SINDUSCON' },
                  { value: 'SELIC', label: 'SELIC' },
                ]}
              />
          </label>
        </div>
        <div className={styles.muted}>
          Se não houver índice definido no título, utilize IPCA-E conforme prática judicial.
        </div>
        <div className={styles.muted}>
          Preset TJMS: até 31/08/2024 usa IPCA-E + 1% a.m.; a partir de 01/09/2024 usa IPCA + taxa legal (SELIC deduzido IPCA).
        </div>
      </section>

      <section className={styles.card}>
        <h3 className={styles.sectionTitle}>Juros moratórios</h3>
        <div className={styles.grid}>
          <label className={styles.field}>
            <span>Modo de juros</span>
              <UISelect
                className={styles.input}
                value={interestMode}
                onChange={(value) => setInterestMode(value as InterestMode)}
                ariaLabel="Modo de juros"
                options={[
                  { value: 'CUSTOM', label: 'Juros de contagem' },
                  { value: 'SPECIAL', label: 'Juros especiais' },
                ]}
              />
          </label>

          {interestMode === 'CUSTOM' ? (
            <>
              <label className={styles.field}>
                <span>Taxa de juros</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={styles.input}
                  value={interestRate}
                  onChange={(e) => setInterestRate(Math.max(0, Number(e.target.value) || 0))}
                />
              </label>
              <label className={styles.field}>
                <span>Periodicidade</span>
                  <UISelect
                    className={styles.input}
                    value={interestPeriod}
                    onChange={(value) => setInterestPeriod(value as InterestPeriod)}
                    ariaLabel="Periodicidade"
                    options={[
                      { value: 'MONTHLY', label: 'Mensal' },
                      { value: 'YEARLY', label: 'Anual' },
                      { value: 'DAILY', label: 'Diária' },
                    ]}
                  />
              </label>
            </>
          ) : (
            <>
              <label className={`${styles.field} ${styles.fieldWide}`}>
                <span>Tabela especial</span>
                  <UISelect
                    className={styles.input}
                    value={specialInterest}
                    onChange={(value) => setSpecialInterest(value as SpecialInterest)}
                    ariaLabel="Tabela especial"
                    options={[
                      { value: 'LEGAL_406_2002', label: 'Taxa legal (art. 406 CC)' },
                      { value: 'SELIC_IPCA_14905', label: 'Taxa legal + art. 406 (Lei 14.905/24)' },
                      { value: 'POUPANCA', label: 'Juros da poupança' },
                      { value: 'SELIC_DAILY', label: 'SELIC diária' },
                    ]}
                  />
              </label>
              <label className={`${styles.secondaryButton} ${styles.checkboxButton}`}>
                <input
                  type="checkbox"
                  checked={drcalcCompatMode}
                  onChange={(e) => setDrcalcCompatMode(e.target.checked)}
                />
                <span>Modo compatibilidade DrCalc</span>
              </label>
              {drcalcCompatMode ? (
                <div className={`${styles.field} ${styles.fieldWide}`}>
                  <span>Taxas mensais (opcional, formato AAAA-MM=0,58)</span>
                  <textarea
                    className={styles.textarea}
                    value={monthlyRateOverridesRaw}
                    onChange={(e) => setMonthlyRateOverridesRaw(e.target.value)}
                    placeholder={'2026-01=0,58\n2026-02=0,57'}
                  />
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() =>
                        setMonthlyRateOverridesRaw(defaultMonthlyOverridesText)
                      }
                    >
                      Preencher padrão 2000-atual
                    </button>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => setMonthlyRateOverridesRaw('')}
                    >
                      Limpar taxas
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>

      <section className={styles.card}>
        <h3 className={styles.sectionTitle}>Multa, honorários e custas</h3>
        <div className={styles.grid}>
          <label className={styles.field}>
            <span>Multa (%)</span>
            <input
              type="number"
              min={0}
              step="0.01"
              className={styles.input}
              value={finePercent}
              onChange={(e) => setFinePercent(Math.max(0, Number(e.target.value) || 0))}
            />
          </label>

          <label className={styles.field}>
            <span>Tipo de honorários</span>
              <UISelect
                className={styles.input}
                value={feesMode}
                onChange={(value) => setFeesMode(value as FeesMode)}
                ariaLabel="Tipo de honorários"
                options={[
                  { value: 'PERCENT', label: 'Percentual (%)' },
                  { value: 'FIXED', label: 'Valor fixo (R$)' },
                ]}
              />
          </label>

          <label className={styles.field}>
            <span>{feesMode === 'PERCENT' ? 'Honorários (%)' : 'Honorários (R$)'}</span>
            <input
              type="number"
              min={0}
              step="0.01"
              className={styles.input}
              value={feesValue}
              onChange={(e) => setFeesValue(Math.max(0, Number(e.target.value) || 0))}
            />
          </label>

          <label className={styles.field}>
            <span>Custas processuais (R$)</span>
            <input
              type="number"
              min={0}
              step="0.01"
              className={styles.input}
              value={courtCosts}
              onChange={(e) => setCourtCosts(Math.max(0, Number(e.target.value) || 0))}
            />
          </label>
        </div>
      </section>

      <section className={styles.card}>
        <h3 className={styles.sectionTitle}>Itens para cálculo</h3>
        <div className={styles.actions}>
          <label className={styles.field}>
            <span>Quantidade de linhas visíveis</span>
            <input
              className={styles.input}
              type="number"
              min={1}
              max={480}
              value={rowCount}
              onChange={(e) => setRowCount(Math.max(1, Math.min(480, Number(e.target.value) || 1)))}
            />
          </label>
          <button type="button" className={styles.primaryButton} onClick={addRow}>
            Adicionar item
          </button>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>Data da parcela</th>
                <th>Juros desde</th>
                <th>Valor</th>
                <th>Descrição do item</th>
                <th>Tipo</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, rowCount).map((row, index) => (
                <tr key={row.id}>
                  <td>{index + 1}</td>
                  <td>
                    <input
                      type="date"
                      className={styles.input}
                      value={row.dueDate}
                      onChange={(e) => updateRow(row.id, { dueDate: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="date"
                      className={styles.input}
                      value={row.interestFromDate}
                      onChange={(e) => updateRow(row.id, { interestFromDate: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className={styles.input}
                      value={row.principal}
                      onChange={(e) =>
                        updateRow(row.id, {
                          principal: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      className={styles.input}
                      value={row.description}
                      onChange={(e) => updateRow(row.id, { description: e.target.value })}
                    />
                  </td>
                  <td>
                      <UISelect
                        className={styles.input}
                        value={row.kind}
                        onChange={(value) => updateRow(row.id, { kind: value as ParcelKind })}
                        ariaLabel="Tipo da linha"
                        options={[
                          { value: 'DEBITO', label: 'Débito' },
                          { value: 'PAGAMENTO', label: 'Crédito/Pagamento' },
                          { value: 'CUSTAS', label: 'Custas/Despesas' },
                        ]}
                      />
                  </td>
                  <td>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => removeRow(row.id)}
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.card}>
        <h3 className={styles.sectionTitle}>Resumo do cálculo</h3>
        <div className={styles.resultGrid}>
          <article className={styles.kpi}>
            <span>Principal</span>
            <strong>{brl(result.principalTotal)}</strong>
          </article>
          <article className={styles.kpi}>
            <span>Correção</span>
            <strong>{brl(result.correctionTotal)}</strong>
          </article>
          <article className={styles.kpi}>
            <span>Juros</span>
            <strong>{brl(result.interestTotal)}</strong>
          </article>
        </div>
        <div className={styles.resultGrid}>
          <article className={styles.kpi}>
            <span>Multa</span>
            <strong>{brl(result.fineTotal)}</strong>
          </article>
          <article className={styles.kpi}>
            <span>Honorários</span>
            <strong>{brl(result.fees)}</strong>
          </article>
          <article className={styles.kpi}>
            <span>Total atualizado</span>
            <strong>{brl(result.total)}</strong>
          </article>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Item</th>
                <th>Data</th>
                <th>Juros desde</th>
                <th>Atraso</th>
                <th>Principal</th>
                <th>Correção</th>
                <th>Multa</th>
                <th>Juros</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {result.lines.map((line) => (
                <tr key={line.id}>
                  <td>{line.description}</td>
                  <td>{asDateBR(line.dueDate)}</td>
                  <td>{asDateBR(line.interestFromDate || line.dueDate)}</td>
                  <td>{line.daysLate} dia(s)</td>
                  <td>{brl(line.principal)}</td>
                  <td>{brl(line.correction)}</td>
                  <td>{brl(line.fine)}</td>
                  <td>{brl(line.interest)}</td>
                  <td>{brl(line.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.muted}>
          Base de cálculo simulada para apoio técnico (versão inicial). A conferência jurídica final deve ser feita pelo responsável.
        </div>
        {calcLabel ? <div className={styles.muted}>Memória: {calcLabel}</div> : null}
      </section>
    </main>
  );
}
