'use client';

import { useEffect, useMemo, useState } from 'react';
import { AccessDeniedView } from '@/components/AccessDeniedView';
import { BackButton } from '@/components/BackButton';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { UISelect } from '@/components/ui/Select';
import styles from '../calculators.module.css';

const STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
];

function toDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

function asIsoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function asDateBR(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR');
}

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function parseHolidaySet(raw: string) {
  const set = new Set<string>();
  raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(line)) {
        set.add(line);
        return;
      }
      const m = line.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (m) set.add(`${m[3]}-${m[2]}-${m[1]}`);
    });
  return set;
}

function isBusinessDay(date: Date, holidays: Set<string>) {
  const day = date.getDay();
  if (day === 0 || day === 6) return false;
  return !holidays.has(asIsoDate(date));
}

function nextBusinessDay(date: Date, holidays: Set<string>) {
  const d = new Date(date);
  while (!isBusinessDay(d, holidays)) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

type HolidayApiItem = {
  date: string;
  name: string;
  scope: 'NATIONAL' | 'STATE' | 'MUNICIPAL';
  source: string;
};

type HolidayApiResponse = {
  holidays: HolidayApiItem[];
  cacheHit?: boolean;
  source?: string;
};

export default function DeadlineCalculatorPage() {
  const [canReadCalculator, setCanReadCalculator] = useState<boolean | null>(null);
  const [uf, setUf] = useState('MS');
  const [city, setCity] = useState('');
  const [cities, setCities] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [days, setDays] = useState(15);
  const [mode, setMode] = useState<'BUSINESS' | 'CALENDAR'>('BUSINESS');
  const [holidaysText, setHolidaysText] = useState('');
  const [holidaysInfo, setHolidaysInfo] = useState('');
  const [loadingHolidays, setLoadingHolidays] = useState(false);

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

  useEffect(() => {
    let active = true;
    async function loadCities() {
      try {
        const resp = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`);
        if (!resp.ok) return;
        const data = (await resp.json()) as Array<{ nome: string }>;
        if (!active) return;
        const names = data.map((item) => item.nome).sort((a, b) => a.localeCompare(b, 'pt-BR'));
        setCities(names);
      } catch {
        setCities([]);
      }
    }
    loadCities();
    return () => {
      active = false;
    };
  }, [uf]);

  const selectedYear = useMemo(() => {
    if (startDate) {
      const year = Number(startDate.slice(0, 4));
      if (Number.isFinite(year) && year > 0) return year;
    }
    return new Date().getFullYear();
  }, [startDate]);

  const resolvedCity = useMemo(() => {
    const raw = city.trim();
    if (!raw) return '';
    const target = normalizeText(raw);
    const match = cities.find((item) => normalizeText(item) === target);
    return match || '';
  }, [city, cities]);

  useEffect(() => {
    if (!uf) return;
    let active = true;
    setLoadingHolidays(true);
    setHolidaysInfo('');

    async function loadHolidays() {
      try {
        const params = new URLSearchParams({
          year: String(selectedYear),
          uf,
        });
        if (resolvedCity) params.set('city', resolvedCity);
        const resp = await fetch(`/api/calculators/holidays?${params.toString()}`, {
          cache: 'no-store',
        });
        if (!resp.ok) {
          const text = await resp.text().catch(() => '');
          throw new Error(text || `Falha ao carregar feriados (${resp.status})`);
        }
        const data = (await resp.json()) as HolidayApiResponse;
        if (!active) return;
        const lines = (data.holidays || []).map((item) => item.date);
        setHolidaysText(lines.join('\n'));
        const source = data.source || '-';
        setHolidaysInfo(
          `${lines.length} feriado(s) carregado(s) para ${selectedYear} · fonte: ${source}${data.cacheHit ? ' · cache' : ''}`,
        );
      } catch {
        if (!active) return;
        setHolidaysInfo('Não foi possível carregar feriados automáticos. Você pode informar manualmente.');
      } finally {
        if (active) setLoadingHolidays(false);
      }
    }
    loadHolidays();
    return () => {
      active = false;
    };
  }, [selectedYear, uf, resolvedCity]);

  const result = useMemo(() => {
    if (!startDate || !days || days < 1) return null;
    const holidays = parseHolidaySet(holidaysText);
    let cursor = toDate(startDate);
    cursor.setDate(cursor.getDate() + 1); // exclui o dia inicial

    if (mode === 'BUSINESS') {
      cursor = nextBusinessDay(cursor, holidays);
    }

    const memory: string[] = [];
    let count = 0;
    while (count < days) {
      if (mode === 'CALENDAR') {
        count += 1;
        memory.push(`${count}º dia: ${asDateBR(asIsoDate(cursor))}`);
      } else if (isBusinessDay(cursor, holidays)) {
        count += 1;
        memory.push(`${count}º dia útil: ${asDateBR(asIsoDate(cursor))}`);
      }

      if (count < days) cursor.setDate(cursor.getDate() + 1);
    }

    return {
      dueDate: asIsoDate(cursor),
      consideredCity: city || 'Não informada',
      holidayCount: holidays.size,
      memory,
    };
  }, [startDate, days, mode, holidaysText, city]);

  if (canReadCalculator === false) {
    return <AccessDeniedView area="Calculadoras" />;
  }

  return (
    <main className={`${styles.page} appPageShell`}>
      <SectionHeader
        title="Calculadora de prazos"
        description="Simulação de contagem com estado/cidade e feriados locais."
        headingAs="h1"
        className={styles.header}
        actions={<BackButton fallbackHref="/dashboard" className={styles.backLink} />}
      />

      <section className={styles.card}>
        <div className={styles.grid}>
            <label className={styles.field}>
              <span>Estado (UF)</span>
              <UISelect
                className={styles.input}
                value={uf}
                onChange={setUf}
                ariaLabel="Estado (UF)"
                options={STATES.map((item) => ({ value: item, label: item }))}
              />
            </label>

          <label className={styles.field}>
            <span>Cidade</span>
            <input
              className={styles.input}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              list="city-options"
              placeholder="Selecione ou digite a cidade"
            />
            <datalist id="city-options">
              {cities.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </label>

          <label className={styles.field}>
            <span>Data inicial (intimação/publicação)</span>
            <input className={styles.input} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>

          <label className={styles.field}>
            <span>Quantidade de dias</span>
            <input
              className={styles.input}
              type="number"
              min={1}
              value={days}
              onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>

            <label className={styles.field}>
              <span>Tipo de contagem</span>
              <UISelect
                className={styles.input}
                value={mode}
                onChange={(value) => setMode(value as 'BUSINESS' | 'CALENDAR')}
                ariaLabel="Tipo de contagem"
                options={[
                  { value: 'BUSINESS', label: 'Dias úteis (estilo SAJ)' },
                  { value: 'CALENDAR', label: 'Dias corridos' },
                ]}
              />
            </label>

          <label className={`${styles.field} ${styles.fieldWide}`}>
            <span>Feriados locais (um por linha: dd/mm/aaaa ou aaaa-mm-dd)</span>
            <textarea
              className={styles.textarea}
              value={holidaysText}
              onChange={(e) => setHolidaysText(e.target.value)}
              placeholder="Ex.: 25/01/2026"
            />
            <div className={styles.muted}>
              {loadingHolidays ? 'Carregando feriados automáticos...' : holidaysInfo}
            </div>
          </label>
        </div>
      </section>

      {result ? (
        <section className={styles.card}>
          <div className={styles.resultGrid}>
            <article className={styles.kpi}>
              <span>Vencimento calculado</span>
              <strong>{asDateBR(result.dueDate)}</strong>
            </article>
            <article className={styles.kpi}>
              <span>Cidade considerada</span>
              <strong>{result.consideredCity}</strong>
            </article>
            <article className={styles.kpi}>
              <span>Feriados informados</span>
              <strong>{result.holidayCount}</strong>
            </article>
          </div>

          <div className={styles.memoryList}>
            {result.memory.slice(0, 40).map((item) => (
              <div key={item} className={styles.memoryItem}>{item}</div>
            ))}
          </div>
          <div className={styles.muted}>Observação: cálculo simulado para apoio operacional.</div>
        </section>
      ) : null}
    </main>
  );
}
