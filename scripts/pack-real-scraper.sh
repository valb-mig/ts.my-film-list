#!/usr/bin/env bash
# Empacota os arquivos de scraper REAL (gitignorados/não commitados) num zip
# com installer, pra reaplicar num clone novo do repo sem passar pelo git.
#
# NÃO roda em CI, NÃO comita nada. Gera scraper-overlay.zip na raiz do repo
# (já coberto pelo .gitignore, mas confira antes de subir qualquer coisa).
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

OUT_ZIP="scraper-overlay.zip"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

mkdir -p "$STAGE/overlay"

# 1. arquivos gitignorados dentro de src/lib/scrapers (os scrapers reais em si)
mapfile -t IGNORED < <(git ls-files --others --ignored --exclude-standard -- src/lib/scrapers)

# 2. arquivos rastreados e modificados (contrato religado pro real: index.ts,
#    registry.ts, config.json)
mapfile -t MODIFIED < <(git diff --name-only -- src/lib/scrapers src/lib/datasource)

# 3. arquivos novos e não rastreados (ex: datasource/imdb.ts)
mapfile -t UNTRACKED < <(git ls-files --others --exclude-standard -- src/lib/scrapers src/lib/datasource)

FILES=("${IGNORED[@]}" "${MODIFIED[@]}" "${UNTRACKED[@]}")

if [ -f .env.local ]; then
  FILES+=(".env.local")
fi

if [ "${#FILES[@]}" -eq 0 ]; then
  echo "Nada pra empacotar: nenhum arquivo real de scraper encontrado (gitignored/modificado/untracked)." >&2
  exit 1
fi

echo "Arquivos incluídos no overlay:"
declare -A SEEN
for f in "${FILES[@]}"; do
  [ -z "$f" ] && continue
  [ -n "${SEEN[$f]:-}" ] && continue
  SEEN[$f]=1
  mkdir -p "$STAGE/overlay/$(dirname "$f")"
  cp "$f" "$STAGE/overlay/$f"
  echo "  - $f"
done

# Installer POSIX (Linux/Mac)
cat > "$STAGE/install.sh" <<'EOS'
#!/usr/bin/env bash
# Roda isso na raiz do clone novo do repo (onde está esse script após extrair o zip).
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d overlay ]; then
  echo "Pasta overlay/ não encontrada. Extraia o zip inteiro antes de rodar." >&2
  exit 1
fi

echo "Copiando arquivos do overlay pro repo..."
cp -rv overlay/. .

if [ -f .env.local ]; then
  if grep -q '^DATA_SOURCE=' .env.local; then
    sed -i.bak 's/^DATA_SOURCE=.*/DATA_SOURCE=real/' .env.local && rm -f .env.local.bak
  else
    echo 'DATA_SOURCE=real' >> .env.local
  fi
else
  echo 'DATA_SOURCE=real' > .env.local
fi

echo
echo "Overlay aplicado. .env.local agora está com DATA_SOURCE=real."
echo "Esses arquivos ficam fora do git (veja .gitignore) — NÃO dar 'git add .' sem checar antes."
EOS
chmod +x "$STAGE/install.sh"

# Installer Windows
cat > "$STAGE/install.bat" <<'EOB'
@echo off
setlocal
cd /d "%~dp0"

if not exist overlay (
  echo Pasta overlay nao encontrada. Extraia o zip inteiro antes de rodar.
  exit /b 1
)

echo Copiando arquivos do overlay pro repo...
xcopy overlay "." /E /I /Y /Q

if exist .env.local (
  findstr /B "DATA_SOURCE=" .env.local >nul
  if errorlevel 1 (
    echo DATA_SOURCE=real>> .env.local
  ) else (
    powershell -Command "(Get-Content .env.local) -replace '^DATA_SOURCE=.*', 'DATA_SOURCE=real' | Set-Content .env.local"
  )
) else (
  echo DATA_SOURCE=real> .env.local
)

echo.
echo Overlay aplicado. .env.local agora esta com DATA_SOURCE=real.
echo Esses arquivos ficam fora do git ^(veja .gitignore^) -- NAO dar "git add ." sem checar antes.
EOB

if command -v zip >/dev/null 2>&1; then
  (cd "$STAGE" && zip -qr "$OLDPWD/$OUT_ZIP" overlay install.sh install.bat)
elif command -v python3 >/dev/null 2>&1; then
  (cd "$STAGE" && python3 -m zipfile -c "$OLDPWD/$OUT_ZIP" overlay install.sh install.bat)
else
  echo "Precisa de 'zip' ou 'python3' instalado pra gerar o overlay." >&2
  exit 1
fi

echo
echo "Zip gerado: $OUT_ZIP"
echo "Esse zip NÃO deve ser commitado (já está no .gitignore). Guarda ele fora do repo"
echo "(pendrive, storage pessoal, etc). Pra aplicar num clone novo: extrai o zip na raiz"
echo "do repo e roda ./install.sh (Linux/Mac) ou install.bat (Windows)."
