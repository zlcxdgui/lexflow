# Tenant Lifecycle Policy

## Status
- `ACTIVE`: tenant operacional.
- `INACTIVE`: tenant desativado para operação diária.

## Transições
- `ACTIVE -> INACTIVE`
  - permitido apenas para `ADMIN` global.
  - membros ativos do tenant são desativados.
  - convites pendentes são cancelados.
  - evento auditado como `TENANT_STATUS_UPDATED`.
- `INACTIVE -> ACTIVE`
  - permitido apenas para `ADMIN` global.
  - o admin que reativa recupera vínculo ativo `ADMIN` no tenant.
  - evento auditado como `TENANT_STATUS_UPDATED`.

## Retenção
- Dados do tenant (`clients`, `matters`, `tasks`, `deadlines`, `documents`, `audit`) não são removidos na desativação.
- Convites pendentes são cancelados na desativação.
- Exclusão física de tenant não é exposta por endpoint de aplicação.

## Governança
- Ações de governança (`switch`, `create`, `rename`, `status`) passam por rate limiting.
- Excesso de tentativas gera `SECURITY_RATE_LIMIT_HIT` no audit log.
- Audit log inclui metadados de request: `requestId`, `ip`, `userAgent`.
