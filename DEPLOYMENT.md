# VUKA Academy — Deployment externo

Este documento prepara a aplicação para uma hospedagem independente do Manus. **Nenhum deploy é executado por este documento.** A stack permanece React 19, Vite, Express, tRPC, Drizzle ORM, MySQL/TiDB e storage compatível com S3.

## 1. Checklist de portabilidade

- [ ] Provisionar Node.js 20+ e npm ou pnpm 10+.
- [ ] Provisionar MySQL 8+ ou TiDB compatível.
- [ ] Provisionar bucket S3-compatible privado para vídeos, PDFs, materiais, trabalhos e certificados.
- [ ] Escolher um provider OAuth/OIDC externo e adaptar `server/_core/sdk.ts` e `server/_core/oauth.ts` mantendo `ctx.user`.
- [ ] Configurar um provider de email transacional.
- [ ] Configurar um provider de pagamentos e o segredo de webhook.
- [ ] Configurar HTTPS, domínio e URLs de callback OAuth.
- [ ] Definir todos os valores do `.env` no secret manager da hospedagem.
- [ ] Executar migrations e seed numa base vazia de staging.
- [ ] Criar/promover o primeiro administrador por SQL seguro.
- [ ] Testar login, `/admin`, uploads privados, emails, pagamentos e restauração.
- [ ] Executar `npm run check`, `npm test` e `npm run build` no ambiente de staging.

## 2. Instalação

```bash
npm install
# ou: pnpm install --frozen-lockfile
npm run check
npm test
npm run build
```

Em produção:

```bash
NODE_ENV=production npm run start
```

O processo Express usa `PORT` quando fornecida pelo host e serve o bundle criado em `dist/`.

## 3. Banco de dados

`drizzle/schema.ts` é a fonte do schema. As migrations versionadas estão em `drizzle/`. Para uma base externa nova:

```bash
export DATABASE_URL='mysql://user:password@host:3306/vuka_academy'
pnpm drizzle-kit migrate
mysql "$DATABASE_URL" < drizzle/seed.sql
```

Aplique migrations em ordem e faça backup antes de qualquer alteração:

```bash
mysqldump --single-transaction --routines --triggers "$DATABASE_URL" > backup-$(date +%F).sql
mysql "$DATABASE_URL" < backup-2026-01-01.sql
```

O seed contém cursos e conteúdo demonstrativo. Não contém credenciais, passwords ou tokens.

## 4. Primeiro administrador

O login é OAuth/OIDC, não existe password local. O primeiro administrador é promovido quando o `openId` autenticado coincide com `OWNER_OPEN_ID`. Para criar/promover numa base externa, faça uma atualização controlada no banco:

```sql
UPDATE users
SET role = 'admin', isActive = 1
WHERE openId = 'OPEN_ID_DO_ADMIN_OIDC';
```

Se o utilizador ainda não existir, faça primeiro login pelo OAuth para que o callback crie a linha, depois execute o `UPDATE`. Não coloque o `openId`, tokens ou credenciais no frontend. Confirme a promoção:

```sql
SELECT id, openId, name, email, role, isActive FROM users WHERE role = 'admin';
```

## 5. Autenticação e proteção

A aplicação atual usa o adaptador OAuth compatível com Manus: `/api/oauth/callback` troca o código, faz upsert do utilizador e cria um cookie de sessão assinado por `JWT_SECRET`. Em hospedagem externa, substitua o provider no adaptador OAuth ou mantenha um endpoint compatível; não remova a verificação de estado/nonce nem a sessão HttpOnly.

A rota visual é `/admin`, mas a segurança real está no backend: `adminProcedure` exige `ctx.user.role === "admin"`. As mutations e queries administrativas em `/api/trpc/academy/admin/*` são rejeitadas com `FORBIDDEN` para `estudante`, `formador`, `empresa` e utilizadores não autenticados.

## 6. Storage

O adapter atual usa `BUILT_IN_FORGE_API_URL` e `BUILT_IN_FORGE_API_KEY` para obter URLs presignadas e serve materiais através de `/manus-storage/*`. Esta é a principal dependência Manus ainda existente. Para independência total, implemente um adapter S3 em `server/storage.ts` com `@aws-sdk/client-s3` e `@aws-sdk/s3-request-presigner`, preservando os contratos `storagePut`, `storageGet` e `storageGetSignedUrl`.

Migração recomendada:

1. Exportar os objetos do storage atual para o bucket externo.
2. Preservar cada `fileKey`/chave relativa usada em `lesson_materials`.
3. Copiar imagens, vídeos, PDFs, materiais, trabalhos e certificados com metadata MIME correta.
4. Validar downloads autenticados e autorização por matrícula/curso.
5. Trocar o adapter apenas depois de validar staging.
6. Manter o bucket privado; URLs públicas não devem ser gravadas para materiais privados.

## 7. Email e pagamentos

Configure `EMAIL_PROVIDER_URL`, `EMAIL_PROVIDER_KEY`, `EMAIL_FROM` e `EMAIL_REPLY_TO`. O backend envia JSON com `from`, `to`, `subject`, `text` e `html`, e trata falhas sem interromper a criação da notificação.

Configure `PAYMENT_WEBHOOK_SECRET` no secret manager. O endpoint de webhook valida HMAC no servidor e a confirmação deve permanecer idempotente.

## 8. Dependências Manus identificadas

| Dependência | Uso atual | Estratégia externa |
|---|---|---|
| OAuth Manus-compatible SDK | Login, callback e sessão | Substituir pelo SDK OAuth/OIDC escolhido, mantendo `ctx.user` e roles |
| Built-in Forge API | Presigned storage, algumas integrações opcionais | Substituir `server/storage.ts` por S3 externo; desativar integrações não usadas |
| `vite-plugin-manus-runtime` | Runtime/template de desenvolvimento | Remover apenas quando a configuração Vite externa equivalente estiver validada |
| `manus-storage` URL | Proxy privado de materiais | Preservar o contrato durante migração e trocar o backend do proxy |

A aplicação não deve depender de MCP no browser nem expor tokens server-side.

## 9. Observabilidade e operação

- [ ] Ativar logs estruturados e retenção no host.
- [ ] Monitorizar healthcheck HTTP e erros 5xx.
- [ ] Configurar backups automáticos e testar restauração mensalmente.
- [ ] Rotacionar `JWT_SECRET`, chaves de storage, email e pagamentos conforme a política do provider.
- [ ] Limitar tamanho e MIME de uploads no reverse proxy e na aplicação.
- [ ] Configurar CORS, cookies Secure/SameSite e CSP de acordo com o domínio final.
- [ ] Não imprimir secrets em logs ou bundles.
