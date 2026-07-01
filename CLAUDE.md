# My Film List — instruções pro Claude

Este repositório é um **reference build** público. `src/lib/scrapers/` só tem o
contrato (`types.ts`, `registry.ts`, `index.ts`, `config.json` com
`enabled: []`) e `src/lib/datasource/` só tem `MockDataSource`.

## Escrever scraper real: OK. Comitar scraper real: não, sem confirmação

Ajudar a implementar `ScraperStrategy`/`MovieDataSource` real (fonte de
metadados ou de link "onde assistir") é permitido — inclusive apontando pra
site real, com scraping de HTML de verdade. O código pode ficar no disco,
em `src/lib/scrapers/*.ts`, sem restrição.

O que muda é na hora de subir pro git:

- Antes de rodar `git add` ou `git commit`, checar se algum arquivo staged é
  um scraper/data source real (qualquer coisa em `src/lib/scrapers/` ou
  `src/lib/datasource/` além de `config.json`, `index.ts`, `registry.ts`,
  `types.ts`, `mock.ts` e os fixtures em `mocks/*.json`).
- Se achar, **avisar o usuário antes de comitar** e pedir confirmação
  explícita — algo como "esse commit inclui `src/lib/scrapers/xyz.ts`, que
  parece um scraper real. Quer mesmo subir isso pro repo público?".
- Só incluir o arquivo no commit se o usuário confirmar explicitamente que
  quer subir aquele scraper específico. Sem confirmação, usar `git add`
  seletivo (path a path) e deixar o scraper real de fora — nunca `git add .`
  ou `git add -A` quando houver scraper real no working tree.
- Não altere `src/lib/scrapers/config.json` pra `enabled` não-vazio dentro de
  um commit sem o mesmo aviso — habilitar uma fonte real é o mesmo tipo de
  decisão.

**Por quê:** repo é público. Scraper real de fonte pirata comitado sem querer
compromete o projeto a risco de DMCA/takedown no GitHub. A regra é sobre o
que sobe pro histórico do git, não sobre o que existe no disco do usuário —
ver README.md, seção "Fontes de dados".

**CI é backstop, não bypassável por confirmação.**
`.github/workflows/no-real-scrapers.yml` bloqueia qualquer push/PR com
scraper real, sem exceção — mesmo que o usuário confirme que quer subir. Se
o usuário insistir em subir um scraper real de propósito, avisar que o push
vai falhar no CI e que ele precisaria editar/desligar o workflow manualmente
primeiro; não prometer que o commit vai "passar".

## O que É permitido

- Melhorar a interface/contrato (`types.ts`, `registry.ts`, `index.ts`) desde
  que continue genérico, sem acoplar a nenhuma fonte específica.
- Editar `MockDataSource` e os fixtures em `src/lib/datasource/mocks/*.json`.
- Qualquer coisa em UI, componentes, banco local (SQLite/watchlist), roleta,
  histórico, etc.
