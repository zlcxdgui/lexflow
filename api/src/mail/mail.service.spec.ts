import { MailService } from './mail.service';

describe('MailService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    (global as { fetch?: jest.Mock }).fetch = jest.fn();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('deve enviar com Brevo quando configurado em auto', async () => {
    process.env.MAIL_PROVIDER = 'auto';
    process.env.BREVO_API_KEY = 'brevo-key';
    process.env.BREVO_SENDER_EMAIL = 'no-reply@lexflow.dev';

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: jest.fn(),
    });

    const service = new MailService();
    const result = await service.sendInvite({
      to: 'user@lexflow.dev',
      fullName: 'User',
      tenantName: 'LexFlow Demo',
      role: 'LAWYER',
      inviteUrl: 'http://localhost:3001/invite/token',
    });

    expect(result).toEqual({ provider: 'brevo' });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.brevo.com/v3/smtp/email',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('deve fazer fallback para Resend quando Brevo falhar', async () => {
    process.env.MAIL_PROVIDER = 'auto';
    process.env.BREVO_API_KEY = 'brevo-key';
    process.env.BREVO_SENDER_EMAIL = 'no-reply@lexflow.dev';
    process.env.RESEND_API_KEY = 'resend-key';
    process.env.RESEND_FROM = 'LexFlow <no-reply@lexflow.dev>';

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue('brevo down'),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: jest.fn(),
      });

    const service = new MailService();
    const result = await service.sendInvite({
      to: 'user@lexflow.dev',
      fullName: 'User',
      tenantName: 'LexFlow Demo',
      role: 'ASSISTANT',
      inviteUrl: 'http://localhost:3001/invite/token',
    });

    expect(result).toEqual({ provider: 'resend' });
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      'https://api.resend.com/emails',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('deve lançar MAIL_NOT_CONFIGURED quando nenhum provedor estiver configurado', async () => {
    process.env.MAIL_PROVIDER = 'auto';
    delete process.env.BREVO_API_KEY;
    delete process.env.BREVO_SENDER_EMAIL;
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM;

    const service = new MailService();

    await expect(
      service.sendInvite({
        to: 'user@lexflow.dev',
        fullName: 'User',
        tenantName: 'LexFlow Demo',
        role: 'LAWYER',
        inviteUrl: 'http://localhost:3001/invite/token',
      }),
    ).rejects.toThrow('MAIL_NOT_CONFIGURED');
  });
});
