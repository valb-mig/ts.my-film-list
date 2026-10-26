#!/usr/bin/env bash
# Deixa o My Film List "sempre ligado" nesta máquina, a partir de um clone recém-feito:
#   1. dependências (npm) e .env.local (pede o token do TMDB se faltar);
#   2. overlay dos scrapers reais, se você passar um (--overlay, gerado por pack-real-scraper.sh);
#   3. build de produção (scripts/serve.sh --build);
#   4. serviço systemd de usuário que sobe o site sozinho quando o PC liga (127.0.0.1:3100);
#   5. link HTTPS pela Tailscale (`tailscale serve`: só aparelhos da sua tailnet, nada público);
#   6. extensão que fecha os popups do player, instalada nos perfis do Zen.
#
# Pode rodar de novo quando quiser: depois de um `git pull`, ele recompila e reinicia o serviço.
#
# Uso: scripts/setup.sh [--overlay scraper-overlay.zip] [--sem-tailscale] [--sem-extensao]
#      scripts/setup.sh --so-extensao    (só (re)instala a extensão no Zen)
#      scripts/setup.sh --desinstalar
# Variáveis: PORT=3100  TS_HTTPS_PORT=8443  TMDB_ACCESS_TOKEN=… (pra não perguntar)
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
PORT="${PORT:-3100}"
TS_HTTPS_PORT="${TS_HTTPS_PORT:-8443}"
SERVICE="my-film-list"
UNIT="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user/$SERVICE.service"
EXT_DIR="$ROOT/extensions/firefox-popup-closer"
OVERLAY=""
WITH_TAILSCALE=1
WITH_EXTENSION=1
TS_URL=""
EXT_ACTIVE=0

step() { printf '\n\033[1;33m==>\033[0m %s\n' "$*"; }
info() { printf '    %s\n' "$*"; }
warn() { printf '    \033[1;31m!\033[0m %s\n' "$*"; }

port_busy() { (exec 3<>"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null; }

# KEY=valor no .env.local (troca a linha se existir, senão acrescenta).
set_env() {
  python3 -I - .env.local "$1" "$2" <<'PY'
import sys
path, key, value = sys.argv[1:]
lines = open(path).read().splitlines()
for i, line in enumerate(lines):
    if line.startswith(key + "="):
        lines[i] = f"{key}={value}"
        break
else:
    lines.append(f"{key}={value}")
open(path, "w").write("\n".join(lines) + "\n")
PY
}

# Extensão nos perfis do Zen. "install": o .xpi vai em <perfil>/extensions/ e um bloco no user.js
# libera extensão sem assinatura (o Zen é compilado com MOZ_REQUIRE_SIGNING=false) e ativa sozinho
# o que estiver na pasta do perfil. "remove": desfaz. "status": sai com 0 se essa versão já está
# ativa em algum perfil (o Zen só registra depois de reiniciar).
zen_extension() {
  python3 -I - "$1" "$EXT_DIR" <<'PY'
import configparser, json, os, sys, zipfile

mode, ext_dir = sys.argv[1:]
ext_id = json.load(open(os.path.join(ext_dir, "manifest.json")))["browser_specific_settings"]["gecko"]["id"]
BEGIN, END = "// >>> my-film-list (scripts/setup.sh)", "// <<< my-film-list"
PREFS = [
    'user_pref("xpinstall.signatures.required", false);',
    'user_pref("extensions.autoDisableScopes", 14);',
    'user_pref("extensions.startupScanScopes", 1);',
]

profiles = []
for base in (os.path.expanduser("~/.config/zen"), os.path.expanduser("~/.zen")):
    ini = configparser.ConfigParser(interpolation=None)
    if not ini.read(os.path.join(base, "profiles.ini")):
        continue
    for section in ini.sections():
        if "Path" in ini[section] and section.startswith("Profile"):
            path = ini[section]["Path"]
            if ini[section].get("IsRelative", "1") == "1":
                path = os.path.join(base, path)
            if os.path.isdir(path):
                profiles.append(path)

if not profiles:
    if mode != "status":
        print("    nenhum perfil do Zen encontrado")
    sys.exit(2)

if mode == "status":
    version = json.load(open(os.path.join(ext_dir, "manifest.json")))["version"]
    for profile in profiles:
        try:
            addons = json.load(open(os.path.join(profile, "extensions.json")))["addons"]
        except (OSError, ValueError, KeyError):
            continue
        if any(a["id"] == ext_id and a.get("active") and a.get("location") == "app-profile"
               and a.get("version") == version for a in addons):
            sys.exit(0)
    sys.exit(1)

for profile in profiles:
    xpi = os.path.join(profile, "extensions", f"{ext_id}.xpi")
    user_js = os.path.join(profile, "user.js")
    text = open(user_js).read() if os.path.exists(user_js) else ""
    if BEGIN in text:
        start, end = text.index(BEGIN), text.index(END) + len(END)
        text = (text[:start] + text[end:]).strip("\n")
        text = text + "\n" if text else ""

    if mode == "install":
        os.makedirs(os.path.dirname(xpi), exist_ok=True)
        with zipfile.ZipFile(xpi, "w", zipfile.ZIP_DEFLATED) as z:
            for name in sorted(os.listdir(ext_dir)):
                if name.endswith((".json", ".js")):
                    z.write(os.path.join(ext_dir, name), name)
        text += "\n".join([BEGIN, *PREFS, END]) + "\n"
    elif os.path.exists(xpi):
        os.remove(xpi)

    with open(user_js, "w") as f:
        f.write(text)
    print(f"    {os.path.basename(profile)}")
PY
}

install_extension() {
  step "Extensão que fecha os popups do player (Zen)"
  if ! zen_extension install; then
    warn "instale à mão: extensions/firefox-popup-closer/README.md"
    return 0
  fi
  if zen_extension status; then
    info "já está ativa no Zen"
    EXT_ACTIVE=1
    return 0
  fi
  if ! pgrep -x zen-bin >/dev/null; then
    info "ativa sozinha na próxima vez que você abrir o Zen"
    return 0
  fi
  # O Zen só lê extensões novas (e o user.js) ao iniciar. Matar o processo seria um fechamento
  # sujo (testado: sem as etapas de encerramento); o "Reiniciar normalmente" do about:profiles é o
  # reinício do próprio navegador, que reabre as abas.
  info "O Zen está aberto e só carrega extensões novas ao reiniciar."
  info "Abri o about:profiles nele: clique em \"Reiniciar normalmente…\" (as abas voltam)."
  setsid zen-browser --new-tab about:profiles >/dev/null 2>&1 &
  [ -t 0 ] || return 0
  info "esperando o Zen reiniciar… (Ctrl+C pula a espera)"
  local stop=0
  trap 'stop=1' INT
  for _ in $(seq 1 90); do
    sleep 2 || true
    [ "$stop" = 1 ] && break
    if zen_extension status; then
      info "extensão ativa no Zen ✓"
      EXT_ACTIVE=1
      break
    fi
  done
  trap - INT
  [ "$EXT_ACTIVE" = 1 ] || info "tudo bem: ela ativa sozinha na próxima vez que o Zen reiniciar"
}

uninstall() {
  step "Removendo o serviço, o link da Tailscale e a extensão"
  systemctl --user disable --now "$SERVICE" 2>/dev/null || true
  rm -f "$UNIT"
  systemctl --user daemon-reload
  if command -v tailscale >/dev/null; then
    tailscale serve --https="$TS_HTTPS_PORT" off >/dev/null 2>&1 || true
  fi
  zen_extension remove || true
  info "Pronto. O clone, o banco (data/) e o .env.local ficaram intactos."
}

while [ $# -gt 0 ]; do
  case "$1" in
    --overlay) OVERLAY="$2"; shift 2 ;;
    --sem-tailscale) WITH_TAILSCALE=0; shift ;;
    --sem-extensao) WITH_EXTENSION=0; shift ;;
    --desinstalar) uninstall; exit 0 ;;
    --so-extensao) install_extension; exit 0 ;;
    -h|--help) sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Opção desconhecida: $1 (veja --help)" >&2; exit 1 ;;
  esac
done

step "Conferindo o que precisa"
for cmd in node npm python3 systemctl; do
  command -v "$cmd" >/dev/null || { warn "falta o comando '$cmd'"; exit 1; }
done
node_major=$(node -p 'process.versions.node.split(".")[0]')
[ "$node_major" -ge 18 ] || { warn "precisa do Node 18+ (tem $(node -v))"; exit 1; }
info "node $(node -v), npm $(npm -v)"

if [ -n "$OVERLAY" ] && [ ! -f "$OVERLAY" ]; then
  warn "overlay não encontrado: $OVERLAY"
  warn "Ele só é preciso num clone novo, sem os scrapers (gere com scripts/pack-real-scraper.sh"
  warn "no clone que já tem). Neste clone é só rodar sem --overlay."
  exit 1
fi
if [ -n "$OVERLAY" ]; then
  step "Aplicando o overlay dos scrapers ($OVERLAY)"
  python3 -I - "$OVERLAY" "$ROOT" <<'PY'
import os, sys, zipfile
zip_path, root = sys.argv[1:]
with zipfile.ZipFile(zip_path) as z:
    for name in z.namelist():
        if not name.startswith("overlay/") or name.endswith("/"):
            continue
        rel = name[len("overlay/"):]
        dest = os.path.normpath(os.path.join(root, rel))
        if not dest.startswith(root + os.sep):
            sys.exit(f"caminho suspeito no zip: {name}")
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with z.open(name) as src, open(dest, "wb") as out:
            out.write(src.read())
        print("    " + rel)
PY
fi

step "Configurando o .env.local"
if [ ! -f .env.local ]; then
  cp .env.example .env.local
  info "criado a partir do .env.example"
fi
if ! grep -q '^TMDB_ACCESS_TOKEN=.' .env.local; then
  token="${TMDB_ACCESS_TOKEN:-}"
  if [ -z "$token" ] && [ -t 0 ]; then
    read -rsp "    Token de leitura da API do TMDB (https://www.themoviedb.org/settings/api, Enter pula): " token
    echo
  fi
  if [ -n "$token" ]; then
    set_env TMDB_ACCESS_TOKEN "$token"
    set_env DATA_SOURCE tmdb
    info "token salvo; usando o TMDB"
  else
    warn "sem token do TMDB: o site sobe com os dados de exemplo (DATA_SOURCE=mock)"
  fi
else
  info "já configurado"
fi

step "Instalando dependências"
npm install --no-audit --no-fund --loglevel=error

step "Compilando (build de produção em .next-prod)"
scripts/serve.sh --build

step "Serviço do systemd ($SERVICE → http://127.0.0.1:$PORT)"
mkdir -p "$(dirname "$UNIT")"
cat > "$UNIT" <<EOF
[Unit]
Description=My Film List (http://127.0.0.1:$PORT)
After=network-online.target

[Service]
Type=simple
WorkingDirectory=$ROOT
Environment=PORT=$PORT
Environment=PATH=$(dirname "$(command -v node)"):/usr/local/bin:/usr/bin:/bin
ExecStart="$ROOT/scripts/serve.sh"
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
EOF
systemctl --user daemon-reload
systemctl --user enable "$SERVICE" >/dev/null 2>&1
if port_busy && ! systemctl --user is-active -q "$SERVICE"; then
  warn "a porta $PORT está ocupada (npm run dev?). O serviço tenta de novo a cada 5 s e sobe"
  warn "sozinho quando ela liberar. Pra desenvolver com ele ligado: npm run dev -- -p 3001"
fi
systemctl --user restart "$SERVICE"
if loginctl show-user "$USER" -p Linger 2>/dev/null | grep -q '=yes'; then
  info "linger já ligado: sobe no boot, antes do login"
elif loginctl enable-linger "$USER" 2>/dev/null; then
  info "linger ligado: sobe no boot, antes do login"
else
  warn "sem linger: o site sobe quando você fizer login (sudo loginctl enable-linger $USER muda isso)"
fi
for _ in $(seq 1 60); do
  port_busy && break
  sleep 1
done
if systemctl --user is-active -q "$SERVICE" && port_busy; then
  info "no ar"
else
  warn "ainda não respondeu; veja: journalctl --user -u $SERVICE -n 50"
fi

if [ "$WITH_TAILSCALE" = 1 ]; then
  step "Link pela Tailscale (HTTPS na porta $TS_HTTPS_PORT, só na sua tailnet)"
  if ! command -v tailscale >/dev/null; then
    warn "tailscale não instalado; pulando"
  elif ! tailscale status >/dev/null 2>&1; then
    warn "tailscale desconectado; rode 'tailscale up' e depois este script de novo"
  elif tailscale serve --bg --https="$TS_HTTPS_PORT" "http://127.0.0.1:$PORT" >/dev/null; then
    host=$(tailscale status --json | python3 -I -c 'import json,sys; print(json.load(sys.stdin)["Self"]["DNSName"].rstrip("."))')
    TS_URL="https://$host:$TS_HTTPS_PORT"
    info "$TS_URL"
  else
    warn "o 'tailscale serve' falhou. Sem permissão? sudo tailscale set --operator=$USER"
    warn "Se ele pedir pra ativar HTTPS na tailnet, abra o link que aparecer e rode de novo."
  fi
fi

if [ "$WITH_EXTENSION" = 1 ]; then
  install_extension
fi

step "Pronto"
info "Local:      http://127.0.0.1:$PORT"
[ -n "$TS_URL" ] && info "Tailscale:  $TS_URL  (celular, notebook, qualquer aparelho da tailnet)"
info "Serviço:    systemctl --user status $SERVICE   ·   logs: journalctl --user -u $SERVICE -f"
info "Atualizar:  git pull && scripts/setup.sh"
exit 0
