#!/usr/bin/env bash
# Roda o My Film List em modo produção (Next.js "standalone"). É o que o serviço do systemd
# (scripts/setup.sh) e o hub do projetor sobem.
#
# - compila em .next-prod (NEXT_DIST_DIR), pra o `npm run dev` na mesma pasta seguir funcionando;
# - copia os arquivos estáticos que o modo standalone não leva sozinho;
# - passa DATA_DIR=./data pro servidor (o standalone muda o diretório de trabalho e o SQLite iria
#   parar dentro do build). NUNCA crie um link para data/ dentro do build: o `next build` esvazia a
#   pasta de saída seguindo links, e apagaria o banco de verdade;
# - carrega o .env.local (o server.js do standalone não lê sozinho).
#
# Uso: scripts/serve.sh            sobe o servidor (compila antes se ainda não houver build)
#      scripts/serve.sh --build    só compila
# Variáveis: PORT=3100  HOST=127.0.0.1 (só a própria máquina; a Tailscale faz o proxy)
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
DIST=".next-prod"
STANDALONE="$DIST/standalone"

build() {
  # Versões antigas deste script deixavam esse link; o build seguiria e apagaria ./data.
  if [ -L "$STANDALONE/data" ]; then rm "$STANDALONE/data"; fi
  # Favoritos e listas vivem no banco: guarda uma cópia antes de cada build (as 5 últimas).
  if [ -f data/watchlist.db ]; then
    mkdir -p data/backups
    cp data/watchlist.db "data/backups/watchlist-$(date +%Y%m%d-%H%M%S).db"
    ls -1t data/backups/watchlist-*.db | tail -n +6 | xargs -r rm --
  fi
  NEXT_DIST_DIR="$DIST" npm run build
  mkdir -p "$STANDALONE/$DIST" data
  rm -rf "$STANDALONE/$DIST/static"
  cp -r "$DIST/static" "$STANDALONE/$DIST/static"
  if [ -d public ]; then cp -r public "$STANDALONE/"; fi
}

if [ "${1:-}" = "--build" ]; then
  build
  exit 0
fi

[ -f "$STANDALONE/server.js" ] || build
mkdir -p data

set -a
[ -f .env.local ] && . ./.env.local
set +a
export PORT="${PORT:-3100}" HOSTNAME="${HOST:-127.0.0.1}" NODE_ENV=production DATA_DIR="$ROOT/data"
exec node "$STANDALONE/server.js"
