# LexFlow API

Backend em NestJS + Prisma.

**Setup**
```bash
npm install
npm run start:dev
```

**Ambiente**
- Copie `api/.env.example` para `api/.env`
- Ajuste `DATABASE_URL`, `JWT_SECRET` e `UPLOAD_DIR` conforme necessidade

## Segurança e governança
### 2FA (TOTP)
- `GET /auth/2fa/status`
- `POST /auth/2fa/setup`
- `POST /auth/2fa/enable` com `{ "code": "123456" }`
- `POST /auth/2fa/disable` com `{ "code": "123456" }`

### Sessões ativas
- `GET /auth/sessions`
- `DELETE /auth/sessions/:sessionId`
- `DELETE /auth/sessions` (encerra todas as outras sessões)

Variáveis:
- `AUTH_SESSION_TTL_DAYS` (tempo de vida da sessão)
- `AUTH_MAX_ACTIVE_SESSIONS` (limite de sessões ativas por usuário; excedente é revogado automaticamente)

### Política de senha
Variáveis:
- `AUTH_PASSWORD_MIN_LENGTH`
- `AUTH_PASSWORD_REQUIRE_UPPER`
- `AUTH_PASSWORD_REQUIRE_LOWER`
- `AUTH_PASSWORD_REQUIRE_DIGIT`
- `AUTH_PASSWORD_REQUIRE_SYMBOL`
- `AUTH_PASSWORD_EXPIRES_DAYS` (`0` desativa expiração)

### Auditoria exportável
- CSV: `GET /audit/export.csv` e `GET /matters/:matterId/audit/export.csv`
- PDF: `GET /audit/export.pdf` e `GET /matters/:matterId/audit/export.pdf`

## Backup e restore (rotina automática)
Scripts:
```bash
npm run db:backup
npm run db:restore -- ./backups/lexflow_backup_YYYYMMDD_HHMMSS.dump
```

Exemplo de rotina automática:
- Agendar `npm run db:backup` em Task Scheduler (Windows) ou cron (Linux)
- Guardar os arquivos em armazenamento externo (S3/Drive/servidor de backup)
- Testar restore periodicamente em ambiente de homologação

Mais detalhes no `README.md` da raiz.
