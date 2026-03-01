import { Injectable } from '@nestjs/common';

type InviteMailInput = {
  to: string;
  fullName: string;
  tenantName: string;
  role: string;
  inviteUrl: string;
};

@Injectable()
export class MailService {
  private readonly provider = (
    process.env.MAIL_PROVIDER || 'auto'
  ).toLowerCase();

  private roleLabel(role: string) {
    const value = String(role || '').toUpperCase();
    if (value === 'OWNER') return 'Socio';
    if (value === 'LAWYER') return 'Advogado';
    if (value === 'ASSISTANT') return 'Assistente';
    return value;
  }

  private subject(tenantName: string) {
    return `Convite de acesso ao LexFlow - ${tenantName}`;
  }

  private text(input: InviteMailInput) {
    return [
      `Ola, ${input.fullName}.`,
      '',
      `Voce recebeu um convite para acessar o escritorio ${input.tenantName} no LexFlow.`,
      `Perfil: ${this.roleLabel(input.role)}.`,
      '',
      `Acesse: ${input.inviteUrl}`,
      '',
      'Se voce nao reconhece este convite, ignore este e-mail.',
    ].join('\n');
  }

  private html(input: InviteMailInput) {
    return `
      <div style="font-family:Arial,sans-serif;color:#111;line-height:1.5">
        <h2>Convite LexFlow</h2>
        <p>Ola, <strong>${input.fullName}</strong>.</p>
        <p>Voce recebeu um convite para acessar o escritorio <strong>${input.tenantName}</strong>.</p>
        <p>Perfil: <strong>${this.roleLabel(input.role)}</strong>.</p>
        <p>
          <a href="${input.inviteUrl}" style="display:inline-block;padding:10px 14px;border-radius:8px;background:#111;color:#fff;text-decoration:none">
            Aceitar convite
          </a>
        </p>
        <p style="font-size:12px;color:#555">Se voce nao reconhece este convite, ignore este e-mail.</p>
      </div>
    `;
  }

  private canUseBrevo() {
    return Boolean(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL);
  }

  private canUseResend() {
    return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
  }

  private async sendWithBrevo(input: InviteMailInput) {
    const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY as string,
      },
      body: JSON.stringify({
        sender: {
          email: process.env.BREVO_SENDER_EMAIL,
          name: process.env.BREVO_SENDER_NAME || 'LexFlow',
        },
        to: [{ email: input.to, name: input.fullName }],
        subject: this.subject(input.tenantName),
        textContent: this.text(input),
        htmlContent: this.html(input),
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      throw new Error(`BREVO_SEND_FAILED: ${detail || resp.status}`);
    }
  }

  private async sendWithResend(input: InviteMailInput) {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM,
        to: [input.to],
        subject: this.subject(input.tenantName),
        text: this.text(input),
        html: this.html(input),
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      throw new Error(`RESEND_SEND_FAILED: ${detail || resp.status}`);
    }
  }

  async sendInvite(input: InviteMailInput) {
    const queue: Array<'brevo' | 'resend'> =
      this.provider === 'brevo'
        ? ['brevo', 'resend']
        : this.provider === 'resend'
          ? ['resend', 'brevo']
          : ['brevo', 'resend'];

    const errors: string[] = [];
    for (const p of queue) {
      try {
        if (p === 'brevo' && this.canUseBrevo()) {
          await this.sendWithBrevo(input);
          return { provider: 'brevo' as const };
        }
        if (p === 'resend' && this.canUseResend()) {
          await this.sendWithResend(input);
          return { provider: 'resend' as const };
        }
      } catch (err: unknown) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }

    if (!this.canUseBrevo() && !this.canUseResend()) {
      throw new Error('MAIL_NOT_CONFIGURED');
    }
    throw new Error(errors.join(' | ') || 'MAIL_SEND_FAILED');
  }
}
