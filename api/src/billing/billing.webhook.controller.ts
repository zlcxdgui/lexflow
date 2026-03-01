import { Body, Controller, Headers, Post } from '@nestjs/common';
import { BillingService } from './billing.service';

@Controller('billing/webhooks')
export class BillingWebhookController {
  constructor(private readonly billing: BillingService) {}

  @Post('test')
  async receiveTestWebhook(
    @Body()
    body?: {
      tenantId?: string;
      provider?: string;
      eventType?: string;
      status?: string;
      referenceId?: string;
      payload?: unknown;
    },
    @Headers('x-lexflow-billing-secret') secret?: string,
  ) {
    const expected = process.env.BILLING_WEBHOOK_SECRET;
    if (expected && secret !== expected) {
      return { ok: false, message: 'Webhook secret inválido.' };
    }

    const tenantId = String(body?.tenantId || '').trim();
    if (!tenantId) {
      return { ok: false, message: 'tenantId é obrigatório.' };
    }

    return this.billing.recordWebhookEvent(tenantId, {
      provider: body?.provider || 'test',
      eventType: body?.eventType || 'test.event',
      status: body?.status || null,
      referenceId: body?.referenceId || null,
      payload: body?.payload ?? body ?? null,
    });
  }
}
