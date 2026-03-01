import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import PDFDocument from 'pdfkit';

type HolidayItem = {
  date: string;
  name: string;
  scope: 'NATIONAL' | 'STATE' | 'MUNICIPAL';
  source: string;
};

type CacheRow = {
  payloadJson: string;
  source: string;
  expiresAt: Date;
};

type ChildSupportPdfLine = {
  competenceLabel?: string;
  dueDate?: string;
  principal?: number;
  correction?: number;
  fine?: number;
  interest?: number;
  gross?: number;
  paid?: number;
  balance?: number;
};

type ChildSupportPdfPayload = {
  description?: string;
  uf?: string;
  preset?: string;
  presetVersion?: string;
  legalBasis?: string;
  startDate?: string;
  endDate?: string;
  totals?: {
    totalGross?: number;
    totalPaid?: number;
    totalOpen?: number;
    fees?: number;
    finalTotal?: number;
  };
  lines?: ChildSupportPdfLine[];
};

@Injectable()
export class CalculatorsService {
  private readonly cityIbgeCache = new Map<string, string | null>();

  constructor(private readonly prisma: PrismaService) {}

  async buildChildSupportPdf(input: ChildSupportPdfPayload) {
    const payload = input || {};
    const lines = Array.isArray(payload.lines)
      ? payload.lines.slice(0, 3000)
      : [];

    const money = (value?: number) =>
      Number(value || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      });

    const safeDate = (iso?: string) => {
      if (!iso) return '-';
      const d = new Date(`${iso}T00:00:00`);
      if (Number.isNaN(d.getTime())) return iso;
      return d.toLocaleDateString('pt-BR');
    };

    return new Promise<Buffer>((resolve) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ margin: 36, size: 'A4' });
      const pageWidth =
        doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const startX = doc.page.margins.left;
      const lineBottomGuard = 40;

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      const ensureSpace = (h: number) => {
        if (doc.y + h > doc.page.height - lineBottomGuard) {
          doc.addPage();
        }
      };

      const drawSummaryCard = (
        label: string,
        value: string,
        x: number,
        y: number,
        width: number,
      ) => {
        doc
          .roundedRect(x, y, width, 46, 6)
          .lineWidth(0.8)
          .strokeColor('#D9D9D9')
          .stroke();
        doc
          .fontSize(8)
          .fillColor('#666')
          .text(label, x + 8, y + 6);
        doc
          .fontSize(11)
          .fillColor('#111')
          .text(value, x + 8, y + 20);
      };

      const drawTableHeader = () => {
        const y = doc.y;
        const cols = [100, 64, 64, 64, 64, 64, 64];
        const labels = [
          'Competência',
          'Venc.',
          'Principal',
          'Correção',
          'Multa',
          'Juros',
          'Saldo',
        ];
        let x = startX;
        doc.fontSize(8).fillColor('#111');
        labels.forEach((label, idx) => {
          doc.text(label, x, y, {
            width: cols[idx],
            align: idx === 0 ? 'left' : 'right',
          });
          x += cols[idx];
        });
        doc
          .moveTo(startX, y + 12)
          .lineTo(startX + pageWidth, y + 12)
          .strokeColor('#CFCFCF')
          .lineWidth(0.6)
          .stroke();
        doc.y = y + 16;
      };

      doc
        .fontSize(17)
        .fillColor('#111')
        .text('Memória de Cálculo - Pensão Alimentícia');
      doc.moveDown(0.3);
      doc
        .fontSize(9)
        .fillColor('#333')
        .text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`);
      doc.text(
        `UF: ${payload.uf || '-'}   |   Preset: ${payload.preset || '-'} (${payload.presetVersion || '-'})`,
      );
      doc.text(
        `Período: ${safeDate(payload.startDate)} até ${safeDate(payload.endDate)}`,
      );
      doc.moveDown(0.2);
      doc.text(`Descrição: ${payload.description || '-'}`, {
        width: pageWidth,
      });
      if (payload.legalBasis)
        doc.text(`Fundamento: ${payload.legalBasis}`, { width: pageWidth });

      doc.moveDown(0.6);
      ensureSpace(120);
      const summaryY = doc.y;
      const gap = 8;
      const colWidth = (pageWidth - gap * 2) / 3;
      drawSummaryCard(
        'Total bruto',
        money(payload.totals?.totalGross),
        startX,
        summaryY,
        colWidth,
      );
      drawSummaryCard(
        'Total pago',
        money(payload.totals?.totalPaid),
        startX + colWidth + gap,
        summaryY,
        colWidth,
      );
      drawSummaryCard(
        'Total final',
        money(payload.totals?.finalTotal),
        startX + (colWidth + gap) * 2,
        summaryY,
        colWidth,
      );
      const row2Y = summaryY + 54;
      const colWidth2 = (pageWidth - gap) / 2;
      drawSummaryCard(
        'Saldo aberto',
        money(payload.totals?.totalOpen),
        startX,
        row2Y,
        colWidth2,
      );
      drawSummaryCard(
        'Honorários',
        money(payload.totals?.fees),
        startX + colWidth2 + gap,
        row2Y,
        colWidth2,
      );
      doc.y = row2Y + 54;
      doc.x = startX;

      doc.moveDown(0.5);
      drawTableHeader();

      let lineIndex = 0;
      for (const item of lines) {
        ensureSpace(20);
        if (doc.y + 20 > doc.page.height - lineBottomGuard) {
          doc.addPage();
          drawTableHeader();
        }
        const y = doc.y;
        if (lineIndex % 2 === 0) {
          doc
            .rect(startX, y - 1, pageWidth, 16)
            .fillColor('#FAFAFA')
            .fill();
        }
        doc.fillColor('#111');
        const cols = [100, 64, 64, 64, 64, 64, 64];
        const vals = [
          item.competenceLabel || '-',
          safeDate(item.dueDate),
          money(item.principal),
          money(item.correction),
          money(item.fine),
          money(item.interest),
          money(item.balance),
        ];
        let x = startX;
        vals.forEach((val, idx) => {
          doc.text(val, x + 2, y, {
            width: cols[idx] - 4,
            align: idx === 0 ? 'left' : 'right',
          });
          x += cols[idx];
        });
        doc.y = y + 16;
        lineIndex += 1;
      }

      if (lines.length === 0) {
        doc.text('Sem competências para exibir.');
      }

      doc.end();
    });
  }

  async getHolidays(year: number, uf?: string, city?: string) {
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      throw new BadRequestException('Ano inválido para cálculo de feriados');
    }

    const ufNorm = this.normalizeUf(uf);
    const cityNorm = this.normalizeCity(city);
    const useCityScopedCache = Boolean(cityNorm && this.hasMunicipalProvider());
    const cacheKey = this.cacheKey(
      year,
      ufNorm,
      useCityScopedCache ? cityNorm : null,
    );
    const now = new Date();

    const cachedRows = await this.prisma.$queryRaw<CacheRow[]>`
      SELECT "payloadJson", "source", "expiresAt"
      FROM "HolidayCache"
      WHERE "cacheKey" = ${cacheKey}
      LIMIT 1
    `;

    const cached = cachedRows[0];
    if (cached && new Date(cached.expiresAt).getTime() > now.getTime()) {
      const parsed = this.parsePayload(cached.payloadJson);
      const hasMunicipalInCache = parsed.some(
        (item) => item.scope === 'MUNICIPAL',
      );
      const shouldBypassStaleCityCache =
        Boolean(cityNorm && this.hasMunicipalProvider()) &&
        !hasMunicipalInCache;

      if (shouldBypassStaleCityCache) {
        // Força refresh quando o cache antigo foi criado sem municipal.
      } else {
        return {
          year,
          uf: ufNorm,
          city: cityNorm,
          cacheHit: true,
          source: cached.source,
          holidays: parsed,
        };
      }
    }

    const holidays = await this.fetchHolidays(year, ufNorm, cityNorm);
    const source = this.joinSources(holidays);
    const payload = JSON.stringify(holidays);
    const ttlHours = Number(process.env.HOLIDAYS_CACHE_TTL_HOURS || 72);
    const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);

    await this.prisma.$executeRaw`
      INSERT INTO "HolidayCache"
      ("id", "cacheKey", "year", "country", "uf", "city", "payloadJson", "source", "fetchedAt", "expiresAt", "createdAt", "updatedAt")
      VALUES
      (${randomUUID()}, ${cacheKey}, ${year}, 'BR', ${ufNorm}, ${useCityScopedCache ? cityNorm : null}, ${payload}, ${source}, ${now}, ${expiresAt}, ${now}, ${now})
      ON CONFLICT ("cacheKey")
      DO UPDATE SET
        "payloadJson" = EXCLUDED."payloadJson",
        "source" = EXCLUDED."source",
        "fetchedAt" = EXCLUDED."fetchedAt",
        "expiresAt" = EXCLUDED."expiresAt",
        "updatedAt" = EXCLUDED."updatedAt"
    `;

    return {
      year,
      uf: ufNorm,
      city: cityNorm,
      cacheHit: false,
      source,
      holidays,
    };
  }

  private parsePayload(payloadJson: string): HolidayItem[] {
    try {
      const parsed = JSON.parse(payloadJson) as HolidayItem[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private normalizeUf(uf?: string) {
    const value = (uf || '').trim().toUpperCase();
    if (!value) return null;
    return value.slice(0, 2);
  }

  private normalizeCity(city?: string) {
    const value = (city || '').trim();
    return value || null;
  }

  private normalizeForKey(value?: string | null) {
    if (!value) return 'ALL';
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  private cacheKey(year: number, uf?: string | null, city?: string | null) {
    return `BR:${year}:${this.normalizeForKey(uf)}:${this.normalizeForKey(city)}`;
  }

  private joinSources(holidays: HolidayItem[]) {
    if (holidays.length === 0) return 'EMPTY';
    return Array.from(new Set(holidays.map((h) => h.source))).join('+');
  }

  private hasMunicipalProvider() {
    return Boolean(process.env.FERIADOSAPI_TOKEN);
  }

  private async fetchHolidays(
    year: number,
    uf?: string | null,
    city?: string | null,
  ) {
    let base = await this.fetchFromNager(year, uf);
    if (base.length === 0) {
      base = await this.fetchFromBrasilApi(year);
    }

    const municipal = await this.fetchMunicipalFromFeriadosApi(year, uf, city);
    return this.dedupe([...base, ...municipal]);
  }

  private async fetchFromNager(
    year: number,
    uf?: string | null,
  ): Promise<HolidayItem[]> {
    const resp = await fetch(
      `https://date.nager.at/api/v3/PublicHolidays/${year}/BR`,
    );
    if (!resp.ok) return [];
    const json = (await resp.json()) as Array<{
      date?: string;
      localName?: string;
      name?: string;
      counties?: string[] | null;
    }>;

    const entries: HolidayItem[] = json
      .filter(
        (item) => typeof item?.date === 'string' && item.date.length >= 10,
      )
      .filter((item) => {
        if (!uf) {
          return !item.counties || item.counties.length === 0;
        }
        if (!item.counties || item.counties.length === 0) return true;
        return item.counties.includes(`BR-${uf}`);
      })
      .map(
        (item): HolidayItem => ({
          date: String(item.date).slice(0, 10),
          name: String(item.localName || item.name || 'Feriado'),
          scope:
            !item.counties || item.counties.length === 0 ? 'NATIONAL' : 'STATE',
          source: 'NAGER',
        }),
      )
      .sort((a, b) => a.date.localeCompare(b.date));

    return this.dedupe(entries);
  }

  private async fetchFromBrasilApi(year: number): Promise<HolidayItem[]> {
    const resp = await fetch(
      `https://brasilapi.com.br/api/feriados/v1/${year}`,
    );
    if (!resp.ok) return [];
    const json = (await resp.json()) as Array<{
      date?: string;
      name?: string;
    }>;
    const entries = json
      .filter(
        (item) => typeof item?.date === 'string' && item.date.length >= 10,
      )
      .map((item) => ({
        date: String(item.date).slice(0, 10),
        name: String(item.name || 'Feriado'),
        scope: 'NATIONAL' as const,
        source: 'BRASIL_API',
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    return this.dedupe(entries);
  }

  private async fetchMunicipalFromFeriadosApi(
    year: number,
    uf?: string | null,
    city?: string | null,
  ): Promise<HolidayItem[]> {
    const token = process.env.FERIADOSAPI_TOKEN;
    if (!token || !uf || !city) return [];

    const ibge = await this.resolveCityIbgeCode(uf, city);
    if (!ibge) return [];

    const baseUrl =
      process.env.FERIADOSAPI_BASE_URL || 'https://feriadosapi.com';
    const url = `${baseUrl.replace(/\/$/, '')}/api/v1/feriados/cidade/${ibge}?ano=${year}`;

    let resp: Response;
    try {
      resp = await fetch(url, {
        headers: {
          'x-api-key': token,
          Accept: 'application/json',
        },
      });
    } catch {
      return [];
    }

    if (!resp.ok) return [];

    type RawHoliday = {
      data?: string;
      nome?: string;
      tipo?: string;
      uf?: string;
      codigo_ibge?: number | string;
    };
    type RawPayload = {
      feriados?: RawHoliday[];
    };

    const payload = (await resp.json()) as RawPayload;
    const list = payload.feriados || [];

    const entries: HolidayItem[] = list
      .filter((item) => typeof item?.data === 'string' && item.data.length >= 8)
      .map((item) => {
        const type = String(item.tipo || '').toUpperCase();
        const scope: HolidayItem['scope'] = type.includes('MUNICIPAL')
          ? 'MUNICIPAL'
          : type.includes('ESTADUAL')
            ? 'STATE'
            : 'NATIONAL';

        return {
          date: this.toIsoDate(String(item.data)),
          name: String(item.nome || 'Feriado'),
          scope,
          source: 'FERIADOS_API',
        };
      })
      .filter((item) => item.scope === 'MUNICIPAL' && item.date.length === 10)
      .sort((a, b) => a.date.localeCompare(b.date));

    return this.dedupe(entries);
  }

  private toIsoDate(value: string) {
    const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const br = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (br) return `${br[3]}-${br[2]}-${br[1]}`;
    return '';
  }

  private async resolveCityIbgeCode(uf: string, city: string) {
    const cacheKey = `${uf}:${this.normalizeForKey(city)}`;
    if (this.cityIbgeCache.has(cacheKey)) {
      return this.cityIbgeCache.get(cacheKey) || null;
    }

    let resp: Response;
    try {
      resp = await fetch(
        `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`,
      );
    } catch {
      this.cityIbgeCache.set(cacheKey, null);
      return null;
    }

    if (!resp.ok) {
      this.cityIbgeCache.set(cacheKey, null);
      return null;
    }

    const payload = (await resp.json()) as Array<{
      id?: number;
      nome?: string;
    }>;
    const target = this.normalizeForKey(city);
    const found = payload.find(
      (item) => this.normalizeForKey(String(item.nome || '')) === target,
    );
    const code = found?.id ? String(found.id) : null;
    this.cityIbgeCache.set(cacheKey, code);
    return code;
  }

  private dedupe(entries: HolidayItem[]) {
    const map = new Map<string, HolidayItem>();
    for (const item of entries) {
      const key = `${item.date}::${item.name}`;
      if (!map.has(key)) map.set(key, item);
    }
    return Array.from(map.values());
  }
}
