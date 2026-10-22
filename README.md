# API REST de Tarefas

![CI](https://github.com/voidsilva/api-rest-tarefas/actions/workflows/ci.yml/badge.svg)
![Node](https://img.shields.io/badge/Node.js-22-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-nativo-3178C6?logo=typescript&logoColor=white)
![Deps](https://img.shields.io/badge/dependências-0-success)

API REST de gerenciamento de tarefas com **autenticação JWT**, **validação de dados**, **paginação**, **isolamento por usuário** e **testes automatizados**. Escrita em TypeScript rodando nativamente no Node 22, sem nenhuma dependência externa.

O objetivo é mostrar, sem a "mágica" de frameworks, os fundamentos que uma API de produção precisa ter.

## O que este projeto demonstra

| Tema | Como foi resolvido |
|---|---|
| Autenticação | JWT HS256 assinado com HMAC, verificação com `timingSafeEqual` e expiração |
| Senhas | Hash com `scrypt` + salt aleatório (nunca armazenadas em texto puro) |
| Autorização | Cada usuário só enxerga as próprias tarefas (retorna 404, não vaza existência) |
| Validação | Schema por rota, erros detalhados por campo (`400`) |
| Erros | Classe `AppError` centralizada, status HTTP corretos (400, 401, 404, 409, 413, 500) |
| Segurança | Limite de payload, mensagem genérica no login, header `nosniff` |
| Qualidade | 9 testes de integração com `node:test`, CI no GitHub Actions |
| Deploy | Dockerfile com usuário não-root, healthcheck e encerramento gracioso |

## Arquitetura

```
src/
├── app.ts              # composição das rotas e regras de acesso
├── server.ts           # bootstrap, variáveis de ambiente, graceful shutdown
├── http/router.ts      # roteador com params, middlewares e tratamento de erros
├── modules/
│   ├── auth/           # cadastro, login, JWT e hash de senha
│   └── tasks/          # regras de negócio das tarefas
└── shared/             # erros e validação reutilizáveis
```

## Rodando

Requer **Node 22.18+**.

```bash
export JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
npm start        # ou: npm run dev
npm test
```

Com Docker:

```bash
docker build -t api-tarefas .
docker run -p 3000:3000 -e JWT_SECRET=$JWT_SECRET api-tarefas
```

## Endpoints

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/health` | – | Status da API |
| POST | `/auth/register` | – | Cria usuário |
| POST | `/auth/login` | – | Retorna `accessToken` |
| GET | `/tasks?page=1&limit=10&done=true&search=nf` | ✅ | Lista paginada com filtros |
| GET | `/tasks/:id` | ✅ | Detalha uma tarefa |
| POST | `/tasks` | ✅ | Cria tarefa |
| PATCH | `/tasks/:id` | ✅ | Atualiza parcialmente |
| DELETE | `/tasks/:id` | ✅ | Remove |

### Exemplo

```bash
curl -X POST localhost:3000/auth/register -H "Content-Type: application/json" \
  -d '{"name":"Paulo","email":"paulo@ex.com","password":"senhaforte123"}'

TOKEN=$(curl -s -X POST localhost:3000/auth/login -H "Content-Type: application/json" \
  -d '{"email":"paulo@ex.com","password":"senhaforte123"}' | node -pe "JSON.parse(require('fs').readFileSync(0)).accessToken")

curl -X POST localhost:3000/tasks -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"Emitir nota fiscal"}'
```

Resposta paginada:

```json
{
  "data": [{ "id": "…", "title": "Emitir nota fiscal", "done": false, "createdAt": "…" }],
  "meta": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
}
```

## Próximos passos

- Persistência em PostgreSQL (camada de serviço já isolada para trocar o `Map`)
- Refresh token e rate limit no login
- Documentação OpenAPI

---

Feito por [Paulo Silva](https://github.com/voidsilva) · Licença MIT
