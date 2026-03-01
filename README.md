# LexFlow

Plataforma de gestão jurídica com:
- Backend `NestJS` + `Prisma` + `PostgreSQL`
- Frontend `Next.js`

## Estrutura do projeto
- `api`: API NestJS
- `web`: Aplicação Next.js
- `docs`: Documentação de operação/governança

## Requisitos
- `Node.js` LTS
- `npm`
- `PostgreSQL` local **ou** `Docker`

## Configuração de ambiente

### API
- Desenvolvimento local: copie `api/.env.example` para `api/.env`
- Docker: use `api/.env.docker`

### Web
- Copie `web/.env.local.example` para `web/.env.local`

## Execução em desenvolvimento

### Opção 1: por workspace (raiz)
```bash
npm install
npm run dev
```

### Opção 2: manual
API:
```bash
cd api
npm install
npm run start:dev
```

Web:
```bash
cd web
npm install
npm run dev
```

## Portas padrão
- API: `3000`
- Web: `3001` (recomendado para evitar conflito)
- PostgreSQL via Docker (host): `5433`

## Banco de dados (Prisma)
```bash
cd api
npx prisma generate
npx prisma migrate dev
```

## Seed (dados de exemplo)
```bash
cd api
npm run seed
```

Usuários seed (senha: `123456`):
- `owner@lexflow.dev`
- `lawyer@lexflow.dev`
- `assistant@lexflow.dev`

## Uploads
- Diretório padrão: `api/uploads`
- Para customizar: defina `UPLOAD_DIR` no `.env` da API

## Convites por e-mail (Brevo + Resend)
O sistema envia e-mail ao convidar/reenviar convite de membro.

Variáveis (`api/.env` ou `api/.env.docker`):
- `WEB_APP_URL` (ex: `http://localhost:3001`)
- `MAIL_PROVIDER` (`auto`, `brevo`, `resend`)
- `BREVO_API_KEY`
- `BREVO_SENDER_EMAIL`
- `BREVO_SENDER_NAME` (opcional)
- `RESEND_API_KEY`
- `RESEND_FROM`
- `AUTH_LOCKOUT_MAX_ATTEMPTS` (default `5`)
- `AUTH_LOCKOUT_MINUTES` (default `15`)
- `AUTH_RATE_WINDOW_MS` (default `60000`)
- `AUTH_RATE_MAX` (default `20`)
- `GOVERNANCE_RATE_WINDOW_MS` (default `60000`)
- `GOVERNANCE_RATE_MAX` (default `30`)

Comportamento:
- `MAIL_PROVIDER=auto`: tenta Brevo e depois Resend
- `MAIL_PROVIDER=brevo`: prioriza Brevo
- `MAIL_PROVIDER=resend`: prioriza Resend

## Docker
Use `docker-compose.yml` na raiz.
O compose lê variáveis de `api/.env.docker`.

## Quality Gate

Scripts na raiz:

```bash
npm run ci:quality
```

Executa:
- `lint` (`api` + `web`)
- `test` (`api`, com `--runInBand`)

Para rodar também os testes do frontend:

```bash
npm run ci:quality:full
```

CI (GitHub Actions):
- Workflow: `.github/workflows/quality-gate.yml`
- Em `main`/PR: roda `ci:quality` + `test:cov:api` + `test:web`
- `api` tem threshold mínimo de cobertura global configurado em `api/package.json` (baseline inicial: 10% para branches/functions/lines/statements)

Recomendação de branch protection (GitHub):
- Exigir status check `Quality Gate`
- Bloquear merge com check vermelho

## Permissões (RBAC)

Perfis:
- `ADMIN` (admin de plataforma)
- `OWNER` (sócio)
- `LAWYER` (advogado)
- `ASSISTANT` (assistente)

### Matriz de acesso

| Módulo | ADMIN | OWNER | LAWYER | ASSISTANT |
|--------|-------|-------|--------|-----------|
| Pessoas: listar/ver | ✅ | ✅ | ✅ | ✅ |
| Pessoas: criar/editar | ✅ | ✅ | ✅ | ✅ |
| Pessoas: excluir | ✅ | ✅ | ❌ | ❌ |
| Casos: criar/editar | ✅ | ✅ | ✅ | ✅ |
| Casos: excluir andamento | ✅ | ✅ | ❌ | ❌ |
| Tarefas: listar/ver | ✅ | ✅ | ✅ | ✅ |
| Tarefas: criar/editar | ✅ | ✅ | ✅ | ✅ |
| Tarefas: excluir | ✅ | ✅ | ❌ | ❌ |
| Prazos: listar/ver | ✅ | ✅ | ✅ | ✅ |
| Prazos: criar/editar | ✅ | ✅ | ✅ | ✅ |
| Prazos: excluir | ✅ | ✅ | ❌ | ❌ |
| Documentos: enviar/renomear/pasta-tags | ✅ | ✅ | ✅ | ✅ |
| Documentos: excluir | ✅ | ✅ | ❌ | ❌ |
| Dashboard + notificações | ✅ | ✅ | ✅ | ✅ |
| Histórico/auditoria | ✅ | ✅ | ❌ | ❌ |
| Equipe/convites | ✅ | ✅ | ❌ | ❌ |
| Alternar escritório | ✅ | ❌ | ❌ | ❌ |
| Criar escritório | ✅ | ❌ | ❌ | ❌ |

### Regras relevantes
- `LAWYER` e `ASSISTANT` compartilham permissões operacionais
- Exclusões são restritas a `ADMIN` e `OWNER`
- `ADMIN` não é cargo atribuível em membros de escritório
- Legado `TenantMember.role='ADMIN'` é normalizado para `OWNER`
- Menu “Histórico” visível para `ADMIN` e `OWNER`

## Multi-tenant (baseline enterprise)
- Gestão de escritórios em `/offices` para `ADMIN`
- Troca de escritório (`switch`) apenas para `ADMIN`
- Estado de escritório em `Tenant.isActive`
- Admin global em `User.isPlatformAdmin`
- Rate limit de governança:
  - `GOVERNANCE_RATE_WINDOW_MS` (default `60000`)
  - `GOVERNANCE_RATE_MAX` (default `30`)
- Auditoria com contexto de request (`requestId`, `ip`, `userAgent`)
- Export de auditoria em CSV:
  - `GET /audit/export.csv`
  - `GET /matters/:matterId/audit/export.csv`
- Observabilidade básica:
  - `GET /metrics` (contadores e latência média por rota)
- Política de ciclo de vida/retenção: `docs/tenant-lifecycle-policy.md`

## Validação de fluxo
- PR de validação do pipeline Quality Gate (sem impacto funcional).
