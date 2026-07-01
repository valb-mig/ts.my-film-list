<p align="center">
  <img src="./public/logo.png" alt="My Film List" width="160">
</p>

<h1 align="center">My Film List</h1>

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?logo=tailwind-css&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)

Busca filmes e assiste online, direto no navegador.
Sem cadastro, sem API key.

> 📦 Este é um **reference build**: só a fonte mock vem implementada. A arquitetura é
> plugável desde o início — veja "Fontes de dados" abaixo pra ligar uma fonte real.

## O que faz

- 🔎 **Busca por título** — em tempo real
- 🎭 **Busca por gênero** — navega catálogos inteiros
- 🎬 **Detalhes** — nota, sinopse, gênero, direção, elenco
- ▶️ **Assistir** — legendado e dublado, agregando múltiplas fontes configuráveis
- ⭐ **Coleções** — Minha Lista (watchlist) e Favoritos, salvos localmente
- 🕑 **Explorado** — histórico em coverflow 3D, agrupado por gênero, com filtro e fixar
- 🎡 **Roleta** — sorteia um filme do seu banco (filtre por gênero ou vá no escuro)

Tudo persistido em SQLite local. Nada sai da sua máquina além das chamadas às fontes que você configurar.

---

## Fontes de dados

Nenhuma fonte é fixa em código — tudo passa por duas camadas plugáveis, configuradas por JSON.

**1. Metadados (busca, detalhe, gênero)**

`src/lib/datasource/index.ts` resolve a implementação ativa. Hoje só existe `MockDataSource`
(`mock.ts`), que lê os fixtures estáticos em `src/lib/datasource/mocks/*.json`.

Pra ligar uma fonte real: implemente a interface `MovieDataSource` (`src/lib/datasource/types.ts`)
num arquivo novo e aponte pra ele em `index.ts` (ex: por `process.env.DATA_SOURCE`). Nenhuma rota
ou componente muda — todos falam com `getDataSource()`, nunca com a implementação direto.

**2. Links "onde assistir" (legendado e dublado)**

Pasta `src/lib/scrapers/` — um único sistema pra qualquer tipo de fonte, direta ou via scraping.
Vem vazio nesse build (`config.json` com `enabled: []`), só com o contrato definido:
- `types.ts` define `ScraperStrategy`: um método `scrape({ id, title, year? })` que devolve uma lista de servidores, e um `kind` (`"sub"` ou `"dub"`) que diz em qual coluna da UI o resultado aparece.
- cada fonte vira um arquivo isolado que implementa esse contrato e se registra com um id único em `registry.ts`. Não importa se a fonte precisa raspar HTML pra descobrir servidores ou só monta uma URL fixa a partir do id — é a mesma interface.
- `config.json` decide quais ids ficam ativos (`{ "enabled": ["id-a", "id-b"] }`) — ligar/desligar uma fonte é editar essa lista, sem tocar em código.
- `index.ts` roda todas as fontes ativas em paralelo, junta os resultados e anexa o `kind` de cada uma.

**Para plugar sua própria fonte:** implemente `ScraperStrategy` (ou `MovieDataSource`, pro caso de metadados) num arquivo novo, registre e ative no config — nenhum outro arquivo precisa mudar.

### Variáveis de ambiente

```bash
cp .env.example .env.local
```

`DATA_SOURCE` existe como convenção pra quando você adicionar uma fonte real (ver `index.ts`).
Sem uma fonte real registrada, o app roda só com mock independente do valor.

`.env.local` nunca é commitado.

---

## Rodando com Docker

### Desenvolvimento (hot reload)

```bash
docker compose -f docker-compose.dev.yml up
```

Monta o código como volume. Salvou um arquivo → Next.js recompila. Sem rebuild.

### Produção

```bash
docker compose up --build
```

Build otimizado. Rode `--build` sempre que alterar o código.

---

## Rodando sem Docker

```bash
npm install
npm run dev      # desenvolvimento → http://localhost:3000
npm run build    # build de produção
npm start        # servir build
```

> O banco SQLite é criado automaticamente em `data/watchlist.db` na primeira execução.
> Se o diretório `.next` ficar com permissão de root: `sudo rm -rf .next`.

---

## Stack

- **Next.js 14** (App Router) + **React 18** + **TypeScript**
- **Tailwind CSS**
- **SQLite** (`@libsql/client`)
- **Docker** (Alpine, standalone output)

