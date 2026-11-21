# Pokédex com Times

Pokédex com busca e filtros, login com JWT e montagem de times de até 6 Pokémon com até 4 golpes cada, mostrando as fraquezas, resistências e a cobertura ofensiva do time inteiro.

**Stack:** React 19 + Vite + Tailwind 4 · Node + Express 5 · PostgreSQL · JWT · [PokéAPI](https://pokeapi.co)

## Como rodar

Pré-requisitos: Node 20+ e PostgreSQL.

```bash
# Backend
cd backend
npm install
cp .env.example .env      # ajuste usuário/senha do Postgres e o JWT_SECRET
npm run db:criar          # cria o banco pokedex_db e aplica o schema.sql
npm run sync              # baixa tipos, 1025 Pokémon e golpes da PokéAPI (~20s)
npm run dev               # API em http://localhost:3001

# Frontend (outro terminal)
cd frontend
npm install
npm run dev               # http://localhost:5173 (proxy /api -> 3001)
```

Testes do backend (precisa do banco sincronizado): `cd backend && npm test`

Conta de teste criada durante o desenvolvimento: `teste@pokedex.test` / `pikachu123`.

## Deploy (Vercel + Neon)

O frontend é servido como site estático e o Express roda como função serverless em `api/index.js` (mesmo `backend/app.js` do dev local). As rotas estão em `vercel.json`: `/api/*` vai para o Express e o resto para o React.

1. **Banco:** crie um projeto no [Neon](https://neon.tech) e copie a connection string.
2. **Popular o banco** (uma vez, da sua máquina), no PowerShell, dentro de `backend/`:
   ```powershell
   $env:DATABASE_URL = "postgresql://...neon.tech/neondb?sslmode=require"
   npm run db:criar
   npm run sync
   Remove-Item Env:DATABASE_URL
   ```
3. **Vercel:** importe o repositório (Framework: *Other*; o resto vem do `vercel.json`) e configure as variáveis:
   - `DATABASE_URL`: connection string do Neon (de preferência a *pooled*, com `-pooler` no host)
   - `JWT_SECRET`: texto aleatório e longo
4. Deploy. Cada `git push` na `main` publica de novo.

## Como funciona o cache

- `npm run sync` popula `tipos`, `tipo_eficacia` (matriz 18×18), `pokemon`, `pokemon_tipos`, `golpes` e `pokemon_golpes` (learnset).
- Se um Pokémon não estiver no banco, `GET /api/pokemon/:id` busca na PokéAPI e salva na hora.
- Golpes nascem só com id/nome; os detalhes (tipo, poder, precisão) são buscados sob demanda quando alguém abre a lista de golpes (`detalhes_carregados`).

## API

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/registro` | `{ nome, email, senha }` → `{ token, usuario }` |
| POST | `/api/auth/login` | `{ email, senha }` → `{ token, usuario }` |
| GET | `/api/auth/me` | usuário do token |
| GET | `/api/tipos` | 18 tipos + matriz de eficácia |
| GET | `/api/pokemon` | `busca, tipo, tipo2, geracao, stat, min, ordenar, ordem, pagina, limite` |
| GET | `/api/pokemon/:id` | detalhes + dano recebido por tipo |
| GET | `/api/pokemon/:id/golpes` | golpes que o Pokémon aprende |
| GET/POST | `/api/times` 🔒 | listar / criar `{ nome }` |
| GET/PUT/DELETE | `/api/times/:id` 🔒 | ver completo / renomear `{ nome }` / excluir |
| POST | `/api/times/:id/pokemon` 🔒 | `{ pokemon_id }` (máx. 6) |
| DELETE | `/api/times/:id/pokemon/:membroId` 🔒 | remover do time |
| PUT | `/api/times/:id/pokemon/:membroId/golpes` 🔒 | `{ golpes: [ids] }` (máx. 4, sem repetir, só golpes que ele aprende) |
| GET | `/api/times/:id/analise` 🔒 | defesa por tipo, cobertura ofensiva e alertas |

🔒 = exige `Authorization: Bearer <token>`

## Estrutura

```
backend/
  schema.sql             tabelas
  services/pokeapi.js    integração + cache
  utils/analise.js       cálculo de fraquezas/cobertura (funções puras)
  routes/                auth, pokemon, tipos, times
  scripts/               criar-banco, sync
  tests/                 unitários (análise) + integração (API)
frontend/src/
  paginas/               Pokedex, Entrar, Times, TimeEditor
  componentes/           PokemonModal, GolpesModal, AnaliseTime, ...
```
