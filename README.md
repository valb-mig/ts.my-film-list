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
Sem cadastro. Metadados via TMDB (API key grátis) — veja "Fontes de dados" abaixo.

> 📦 Este é um **reference build**: metadados vêm do TMDB, mas a camada de streams
> (`src/lib/scrapers/`) vem vazia. A arquitetura é plugável desde o início — veja
> "Fontes de dados" abaixo pra ligar uma fonte real de streams.

## O que faz

- 🔎 **Busca por título** — em tempo real
- 🎭 **Busca por gênero** — navega catálogos inteiros
- 🎬 **Detalhes** — nota, sinopse, gênero, direção, elenco
- ▶️ **Assistir** — legendado e dublado, agregando múltiplas fontes configuráveis
- 💬 **Legendas** — download direto do .srt em português e inglês, também por fontes configuráveis
- ⭐ **Coleções** — Favoritos e listas com nome, salvos localmente
- 🎡 **Roleta** — sorteia um filme dos seus favoritos e listas (filtre por gênero e duração ou vá no escuro)

O SQLite local guarda só o que você salva de propósito: favoritos e listas. Busca, detalhes e gêneros
vêm ao vivo da fonte de metadados. Nada sai da sua máquina além das chamadas às fontes que você configurar.

---

## Fontes de dados

Nenhuma fonte é fixa em código — tudo passa por duas camadas plugáveis, configuradas por JSON.

**1. Metadados (busca, detalhe, gênero)**

`src/lib/datasource/index.ts` resolve a implementação ativa. Este build de referência traz
`MockDataSource` (`mock.ts`, fixtures em `src/lib/datasource/mocks/*.json`) e um exemplo de fonte
real, `TmdbDataSource` (`tmdb.ts`), que usa a [API do TMDB](https://developer.themoviedb.org/docs)
pra busca/detalhe/gênero — precisa de `TMDB_ACCESS_TOKEN` (grátis, ver seção abaixo). O IMDb ID de cada
título é resolvido via TMDB (`/find`, `external_ids`) só pra alimentar a camada de streams abaixo.

Pra ligar sua própria fonte: implemente a interface `MovieDataSource` (`src/lib/datasource/types.ts`)
num arquivo novo e aponte pra ele em `index.ts` (ex: por `process.env.DATA_SOURCE`). Nenhuma rota
ou componente muda — todos falam com `getDataSource()`, nunca com a implementação direto.

**2. Links "onde assistir" (legendado e dublado)**

Pasta `src/lib/scrapers/` — um único sistema pra qualquer tipo de fonte, direta ou via scraping.
Vem vazio nesse build (`config.json` com `enabled: []`), só com o contrato definido:
- `types.ts` define `ScraperStrategy`: um método `scrape({ id, title, year? })` que devolve uma lista de servidores, e um `kind` (`"sub"` ou `"dub"`) que diz em qual coluna da UI o resultado aparece.
- cada fonte vira um arquivo isolado que implementa esse contrato e se registra com um id único em `registry.ts`. Não importa se a fonte precisa raspar HTML pra descobrir servidores ou só monta uma URL fixa a partir do id — é a mesma interface.
- `config.json` decide quais ids ficam ativos (`{ "enabled": ["id-a", "id-b"] }`) — ligar/desligar uma fonte é editar essa lista, sem tocar em código.
- `index.ts` roda todas as fontes ativas em paralelo, junta os resultados e anexa o `kind` de cada uma.
- **Legendas (.srt)** usam a mesma pasta, registro e lista `enabled`: em vez de `ScraperStrategy`, a fonte implementa `SubtitleStrategy` (`findSubtitles({ id, title, year?, langs })`) e devolve links diretos de download por idioma (hoje `pt-BR` e `en`), junto com o nome do release pra você saber com qual versão do vídeo ela sincroniza.
- Séries passam `type: "tv"`, `season` e `episode` no mesmo input, tanto pra streams quanto pra legendas.

**Para plugar sua própria fonte:** implemente `ScraperStrategy` (ou `MovieDataSource`, pro caso de metadados) num arquivo novo, registre e ative no config — nenhum outro arquivo precisa mudar.

### Variáveis de ambiente

```bash
cp .env.example .env.local
```

`DATA_SOURCE=mock` força o `MockDataSource`; qualquer outro valor (ou ausente) usa `TmdbDataSource`,
que exige `TMDB_ACCESS_TOKEN` (crie um gratuito em https://www.themoviedb.org/settings/api).

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

> O banco SQLite (favoritos e listas) é criado automaticamente em `data/watchlist.db` na primeira execução.
> Se o diretório `.next` ficar com permissão de root: `sudo rm -rf .next`.

---

## Sempre ligado (serviço + Tailscale + extensão)

Num clone novo, um comando deixa tudo pronto e no ar a cada boot, sem `npm run dev`:

```bash
scripts/setup.sh                                   # ou, com seus scrapers particulares:
scripts/setup.sh --overlay ~/scraper-overlay.zip   # (gerado por scripts/pack-real-scraper.sh)
```

- **Serviço systemd de usuário** (`my-film-list`): build de produção em `.next-prod` servido em
  `127.0.0.1:3100` por [`scripts/serve.sh`](scripts/serve.sh). Sobe no boot (com linger) e reinicia
  se cair. Logs: `journalctl --user -u my-film-list -f`.
- **Tailscale**: `tailscale serve` publica `https://<sua-máquina>.<tailnet>.ts.net:8443` — só para
  aparelhos da sua tailnet, nunca na internet aberta.
- **Extensão do Zen** que fecha os popups dos players embutidos: vai direto nos perfis do Zen. Se o
  Zen estiver aberto, o script abre o `about:profiles` nele — um clique em "Reiniciar normalmente…"
  (as abas voltam) e ele confirma que a extensão ficou ativa. Só a extensão: `scripts/setup.sh --so-extensao`.
  Detalhes em [`extensions/firefox-popup-closer`](extensions/firefox-popup-closer).
- Pede o token do TMDB se faltar (ou `TMDB_ACCESS_TOKEN=… scripts/setup.sh`).

Atualizar: `git pull && scripts/setup.sh`. Remover: `scripts/setup.sh --desinstalar`.
Pra desenvolver com o serviço ligado, rode o dev em outra porta: `npm run dev -- -p 3001` (o build de
produção fica em `.next-prod`, então um não atropela o outro).

**Versão TV (`/tv`):** feita pro controle remoto — fileiras de pôsteres (suas listas, favoritos,
recomendados, em alta…), painel com o filme em foco, setas pra navegar, OK pra abrir, Voltar pra sair.
Dois cliques pra assistir: OK no pôster abre os detalhes já em "Assistir", OK de novo toca (em série,
OK no episódio). Buscar (digitando pelo celular) e Sortear ficam no topo. O hub do
[projetor](https://github.com/valb-mig/projetor-miracast) abre direto nela; em outro navegador, `?tv=1`
na home também leva pra lá.

---

## Stack

- **Next.js 14** (App Router) + **React 18** + **TypeScript**
- **Tailwind CSS**
- **SQLite** (`@libsql/client`)
- **Docker** (Alpine, standalone output)

