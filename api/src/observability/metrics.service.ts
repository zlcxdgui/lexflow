import { Injectable } from '@nestjs/common';

type HttpMetric = {
  method: string;
  route: string;
  statusCode: number;
};

@Injectable()
export class MetricsService {
  private readonly httpCounters = new Map<string, number>();
  private readonly httpLatency = new Map<
    string,
    { count: number; sumMs: number }
  >();

  private key(metric: HttpMetric) {
    return `${metric.method}|${metric.route}|${metric.statusCode}`;
  }

  observeHttp(metric: HttpMetric, durationMs: number) {
    const counterKey = this.key(metric);
    this.httpCounters.set(
      counterKey,
      (this.httpCounters.get(counterKey) || 0) + 1,
    );

    const latencyKey = `${metric.method}|${metric.route}`;
    const current = this.httpLatency.get(latencyKey) || { count: 0, sumMs: 0 };
    current.count += 1;
    current.sumMs += durationMs;
    this.httpLatency.set(latencyKey, current);
  }

  snapshot() {
    const requests = Array.from(this.httpCounters.entries()).map(
      ([key, count]) => {
        const [method, route, statusCode] = key.split('|');
        return { method, route, statusCode: Number(statusCode), count };
      },
    );
    const latencies = Array.from(this.httpLatency.entries()).map(
      ([key, value]) => {
        const [method, route] = key.split('|');
        return {
          method,
          route,
          count: value.count,
          avgMs:
            value.count > 0
              ? Number((value.sumMs / value.count).toFixed(2))
              : 0,
        };
      },
    );

    return {
      generatedAt: new Date().toISOString(),
      requests,
      latencies,
    };
  }
}
