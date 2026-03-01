# Contribuindo

Obrigado por contribuir com o LexFlow. Este guia cobre padrões básicos para manter o projeto consistente.

## Fluxo rápido
1. Crie um branch descritivo a partir de `main`.
2. Faça commits pequenos e focados.
3. Abra um PR descrevendo o problema/solução.

## Padrão de commit
Use Conventional Commits:

```
feat: adiciona filtro por status
fix: corrige validação de prazos
chore: atualiza dependências
docs: atualiza README
```

Tipos comuns: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`.

## Qualidade
- Rode `npm run lint` antes de abrir PR.
- Evite misturar formatação e mudança de lógica no mesmo commit.

## Ambiente
- Backend: `api/.env.example` -> `api/.env`
- Frontend: `web/.env.local.example` -> `web/.env.local`
