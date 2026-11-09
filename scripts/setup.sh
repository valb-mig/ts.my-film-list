#!/usr/bin/env bash
# Deixa o My Film List "sempre ligado" nesta máquina, a partir de um clone recém-feito:
#   1. confere as dependências e a porta (3100, ou oferece a próxima livre se outro programa usa ela);
#   2. overlay dos scrapers reais, se você passar um (--overlay, gerado por pack-real-scraper.sh);
#   3. .env.local: pede o token do TMDB (conferido na API) e o link do site do player, se faltarem;
#   4. dependências (npm) e build de produção (scripts/serve.sh --build), em silêncio, com log em
#      /tmp/my-film-list-setup.log;
#   5. serviço systemd de usuário que sobe o site sozinho quando o PC liga (127.0.0.1:<porta>), e um
#      teste de verdade no fim: um filme pelo TMDB e o link dele no player;
#   6. link HTTPS pela Tailscale (`tailscale serve`: só aparelhos da sua tailnet, nada público);
#   7. extensão que fecha os popups do player, instalada nos perfis do Zen.
#
# Pode rodar de novo quando quiser: depois de um `git pull`, ele recompila e reinicia o serviço.
#
# Uso: scripts/setup.sh [--overlay scraper-overlay.zip] [--sem-tailscale] [--sem-extensao]
#      scripts/setup.sh --reconfigurar   (pergunta token e links de novo, Enter mantém, e reinicia)
#      scripts/setup.sh --so-extensao    (só (re)instala a extensão no Zen)
#      scripts/setup.sh --desinstalar
# Variáveis (pra não perguntar): MFL_PORT=3100  TS_HTTPS_PORT=8443  TMDB_ACCESS_TOKEN=…
#   STREAM_MOVIE_URL=…  STREAM_TV_URL=…   (MFL_PORT e não PORT: muita ferramenta já exporta PORT)
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
TS_HTTPS_PORT="${TS_HTTPS_PORT:-8443}"
SERVICE="my-film-list"
UNIT="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user/$SERVICE.service"
EXT_DIR="$ROOT/extensions/firefox-popup-closer"
LOG="${TMPDIR:-/tmp}/my-film-list-setup.log"
OVERLAY=""
WITH_TAILSCALE=1
WITH_EXTENSION=1
RECONFIGURE=0
TS_URL=""
EXT_ACTIVE=0
QUICK=0
STEP=0
TOTAL=0

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  BOLD=$'\033[1m' DIM=$'\033[2m' RED=$'\033[1;31m' GREEN=$'\033[1;32m' YELLOW=$'\033[1;33m' RESET=$'\033[0m'
else
  BOLD="" DIM="" RED="" GREEN="" YELLOW="" RESET=""
fi

step() {
  STEP=$((STEP + 1))
  if [ "$TOTAL" -gt 0 ]; then
    printf '\n%s[%d/%d]%s %s%s%s\n' "$YELLOW" "$STEP" "$TOTAL" "$RESET" "$BOLD" "$*" "$RESET"
  else
    printf '\n%s==>%s %s%s%s\n' "$YELLOW" "$RESET" "$BOLD" "$*" "$RESET"
  fi
}
info() { printf '    %s\n' "$*"; }
ok() { printf '    %s✓%s %s\n' "$GREEN" "$RESET" "$*"; }
warn() { printf '    %s!%s %s\n' "$RED" "$RESET" "$*"; }
hint() { printf '    %s%s%s\n' "$DIM" "$*" "$RESET"; }

# Sim/não; Enter = sim. Sem terminal, fica com o "sim".
confirm() {
  local answer
  [ -t 0 ] || return 0
  read -rp "    $1 [S/n] " answer
  case "$answer" in [nN]*) return 1 ;; esac
}

port_busy() { (exec 3<>"/dev/tcp/127.0.0.1/${1:-$PORT}") 2>/dev/null; }

# Porta que o serviço já usa: rodando o setup de novo, ela se mantém.
unit_port() { [ -f "$UNIT" ] && sed -n 's/^Environment=PORT=//p' "$UNIT" | head -n 1 || true; }

# Outro programa na porta (não o próprio serviço, que o restart libera)? Oferece a próxima livre em
# vez de instalar um serviço que vai ficar reiniciando com EADDRINUSE.
choose_port() {
  if ! port_busy || { systemctl --user is-active -q "$SERVICE" && [ "$(unit_port)" = "$PORT" ]; }; then
    ok "porta $PORT"
    return 0
  fi
  local alt=$((PORT + 1))
  while port_busy "$alt"; do alt=$((alt + 1)); done
  warn "a porta $PORT já está em uso por outro programa"
  if [ -t 0 ] && confirm "Usar a $alt?"; then
    PORT=$alt
    ok "porta $PORT"
    return 0
  fi
  warn "rode de novo escolhendo outra: MFL_PORT=$alt scripts/setup.sh"
  exit 1
}

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

# Valor atual de KEY no .env.local, sem as aspas simples que os links ganham no set_env.
env_get() {
  local value
  value=$(grep -m 1 "^$1=" .env.local 2>/dev/null | cut -d= -f2-) || true
  value="${value#\'}"
  printf '%s' "${value%\'}"
}

mask() { if [ "${#1}" -gt 12 ]; then printf '%s…%s' "${1:0:4}" "${1: -4}"; else printf '••••'; fi; }

# 200 = token aceito, 401 = recusado, outro = não deu pra conferir (sem internet/curl). O header vai
# pelo stdin pra o token não aparecer no `ps`.
tmdb_status() {
  command -v curl >/dev/null || { echo 000; return; }
  printf 'Authorization: Bearer %s\n' "$1" |
    curl -s -o /dev/null -w '%{http_code}' --max-time 10 -H @- https://api.themoviedb.org/3/authentication || true
}

# Motivo pra recusar um link colado (vazio = formato ok). Barra o que quebraria o .env.local, lido pelo
# Next e pelo `.` do serve.sh: espaço, aspas, $, crase, \.
link_problem() {
  case "$1" in http://?*|https://?*) ;; *) echo "o link precisa começar com http:// ou https://"; return ;; esac
  case "$1" in *[[:space:]]*|*\'*|*\"*|*\$*|*\`*|*\\*) echo "o link não pode ter espaço, aspas, \$, crase nem \\" ;; esac
}

# Link de um filme aberto no player → modelo: o id do IMDb nele (tt0111161) vira {id}. Falha se não
# tiver id nenhum (aí entra o palpite do movie_guess).
link_template() {
  local url="$1"
  case "$url" in *"{id}"*) ;; *) url=$(printf '%s' "$url" | sed -E 's/tt[0-9]{7,}/{id}/') ;; esac
  case "$url" in *"{id}"*) printf '%s' "$url" ;; *) return 1 ;; esac
}

# Palpite pra quem cola só a base do player (https://site/embed, .../embed/movie/): .../movie/{id}, o
# formato mais comum desses players. Sempre passa por confirmação.
movie_guess() {
  local url="${1%/}"
  case "$url" in */movie) printf '%s/{id}' "$url" ;; *) printf '%s/movie/{id}' "$url" ;; esac
}

# Palpite pro link de série a partir do de filme: .../movie/{id} → .../tv/{id}/{season}/{episode}.
tv_guess() {
  case "$1" in
    */movie/*) printf '%s' "$1" | sed -e 's#/movie/#/tv/#' -e 's#{id}#{id}/{season}/{episode}#' ;;
  esac
}

configure_tmdb() {
  local current token=""
  current=$(env_get TMDB_ACCESS_TOKEN)
  if [ -n "$current" ] && [ "$RECONFIGURE" = 0 ]; then
    ok "TMDB: token já configurado"
    return 0
  fi

  token="${TMDB_ACCESS_TOKEN:-}"
  if [ -z "$token" ] && [ -t 0 ]; then
    hint "TMDB: use o \"Token de leitura da API\" (o longo), em https://www.themoviedb.org/settings/api"
  fi
  while :; do
    if [ -z "$token" ] && [ -t 0 ]; then
      if [ -n "$current" ]; then
        read -rsp "    Token do TMDB (Enter mantém o atual, $(mask "$current")): " token
      else
        read -rsp "    Token do TMDB (Enter pula): " token
      fi
      echo
    fi
    [ -n "$token" ] || break
    case "$(tmdb_status "$token")" in
      200) ok "token aceito pelo TMDB"; break ;;
      401) warn "o TMDB recusou esse token (a \"Chave da API\", a curta, não serve aqui)" ;;
      *) warn "não deu pra conferir o token agora (sem internet?); salvando assim mesmo"; break ;;
    esac
    token=""
    [ -t 0 ] || break
  done

  if [ -n "$token" ]; then
    set_env TMDB_ACCESS_TOKEN "$token"
    set_env DATA_SOURCE tmdb
  elif [ -n "$current" ]; then
    ok "token mantido"
  else
    warn "sem token: o site sobe com dados de exemplo (DATA_SOURCE=mock)"
  fi
}

# Site do player: nenhum vem no código, o link fica só no .env.local (src/lib/scrapers/index.ts).
configure_links() {
  local current_movie current_tv link movie_url="" tv_url="" problem guess
  current_movie=$(env_get STREAM_MOVIE_URL)
  current_tv=$(env_get STREAM_TV_URL)
  if [ -n "$current_movie" ] && [ "$RECONFIGURE" = 0 ]; then
    ok "player: link já configurado"
    return 0
  fi

  link="${STREAM_MOVIE_URL:-}"
  if [ -z "$link" ] && [ -t 0 ]; then
    hint "Player: abra um filme qualquer no site onde você assiste e cole o link da página"
    hint "(ex.: https://exemplo.com/embed/movie/tt0111161 — o tt… vira o filme da vez)."
  fi
  while :; do
    if [ -z "$link" ] && [ -t 0 ]; then
      if [ -n "$current_movie" ]; then
        read -rp "    Link de filme [$current_movie] (Enter mantém): " link
        link="${link:-$current_movie}"
      else
        read -rp "    Link de filme (Enter pula): " link
      fi
    fi
    [ -n "$link" ] || break
    problem=$(link_problem "$link")
    if [ -z "$problem" ]; then
      movie_url=$(link_template "$link") && break
      if [ -t 0 ]; then
        guess=$(movie_guess "$link")
        info "esse link não tem filme; no formato mais comum ficaria:"
        if confirm "$guess — confere?"; then
          movie_url=$guess
          break
        fi
      fi
      problem="o link precisa ter um filme: abra um no player e cole (com o id do IMDb, tt…, nele)"
    fi
    warn "$problem"
    link=""
    [ -t 0 ] || break
  done

  if [ -z "$movie_url" ]; then
    warn "sem link do player: os títulos abrem sem essa fonte (cole depois com --reconfigurar)"
    return 0
  fi
  set_env STREAM_MOVIE_URL "'$movie_url'"
  ok "filmes: $movie_url"

  # Reconfigurando com o mesmo link de filme, o de série atual vira o padrão; site novo, palpite novo.
  guess=$(tv_guess "$movie_url")
  if [ -n "$current_tv" ] && [ "$movie_url" = "$current_movie" ]; then
    guess=$current_tv
  fi
  link="${STREAM_TV_URL:-}"
  while :; do
    if [ -z "$link" ] && [ -t 0 ]; then
      if [ -n "$guess" ]; then
        read -rp "    Link de série [$guess] (Enter aceita, - pula): " link
        link="${link:-$guess}"
      else
        read -rp "    Link de série, com {id}, {season} e {episode} (Enter pula): " link
      fi
    elif [ -z "$link" ]; then
      link="$guess"
    fi
    [ -n "$link" ] && [ "$link" != - ] || break
    problem=$(link_problem "$link")
    if [ -z "$problem" ]; then
      tv_url=$(link_template "$link") || true
      case "$tv_url" in *"{season}"*"{episode}"*) break ;; esac
      tv_url=""
      problem="link de série precisa de {id}, {season} e {episode} (ex.: https://exemplo.com/embed/tv/{id}/{season}/{episode})"
    fi
    warn "$problem"
    link=""
    [ -t 0 ] || break
  done

  if [ -n "$tv_url" ]; then
    set_env STREAM_TV_URL "'$tv_url'"
    ok "séries: $tv_url"
  else
    set_env STREAM_TV_URL ""
    info "sem link de série: séries ficam sem esse player"
  fi
}

yes_no() { if [ "$1" = 1 ]; then printf 'sim'; else printf 'não'; fi; }

summary() {
  local token movie tv
  token=$(env_get TMDB_ACCESS_TOKEN)
  movie=$(env_get STREAM_MOVIE_URL)
  tv=$(env_get STREAM_TV_URL)
  printf '\n'
  info "${BOLD}Resumo${RESET}"
  if [ -n "$token" ]; then info "  TMDB       token $(mask "$token")"; else info "  TMDB       dados de exemplo (sem token)"; fi
  info "  Filmes     ${movie:-—}"
  info "  Séries     ${tv:-—}"
  info "  Endereço   http://127.0.0.1:$PORT"
  if [ "$QUICK" = 0 ]; then
    info "  Tailscale  $(yes_no "$WITH_TAILSCALE")   ·   extensão do Zen: $(yes_no "$WITH_EXTENSION")"
  fi
  printf '\n'
}

# Comando longo em silêncio (saída no $LOG) com spinner; se falhar, mostra o fim do log e para.
quiet() {
  local msg="$1" start=$SECONDS pid i=0
  local frames=(⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏)
  shift
  printf '\n--- %s: %s\n' "$(date '+%F %T')" "$*" >>"$LOG"
  "$@" >>"$LOG" 2>&1 &
  pid=$!
  if [ -t 1 ]; then
    while kill -0 "$pid" 2>/dev/null; do
      printf '\r    %s %s %s(%ds)%s' "${frames[i++ % 10]}" "$msg" "$DIM" $((SECONDS - start)) "$RESET"
      sleep 0.1
    done
    printf '\r\033[K'
  fi
  if wait "$pid"; then
    ok "$msg $DIM($((SECONDS - start))s)$RESET"
  else
    warn "$msg falhou. Fim do log ($LOG):"
    tail -n 25 "$LOG" | sed 's/^/      /'
    exit 1
  fi
}

# Espera o próprio site responder: a /api/lists é dele, outro programa na porta não engana.
wait_site() {
  local code
  for _ in $(seq 1 60); do
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "http://127.0.0.1:$PORT/api/lists" || true)
    [ "$code" = 200 ] && return 0
    sleep 1
  done
  return 1
}

json_field() {
  python3 -I -c '
import json, sys
try:
    data = json.load(sys.stdin)
    print(data[0]["servers"][0]["embedUrl"] if sys.argv[1] == "embed" else data.get("title", ""))
except Exception:
    pass
' "$1"
}

# Sobe (ou reinicia) e testa de ponta a ponta com um filme conhecido (Um Sonho de Liberdade).
start_and_check() {
  local base="http://127.0.0.1:$PORT" title embed
  systemctl --user restart "$SERVICE"
  if ! wait_site; then
    warn "o site não respondeu em 60 s. Últimas linhas do serviço:"
    journalctl --user -u "$SERVICE" -n 15 --no-pager -o cat 2>/dev/null | sed 's/^/      /'
    warn "corrija e rode de novo, ou pare com: scripts/setup.sh --desinstalar"
    exit 1
  fi
  ok "no ar em $base"

  if [ -n "$(env_get TMDB_ACCESS_TOKEN)" ]; then
    title=$(curl -s --max-time 20 "$base/api/movie/tt0111161" | json_field title || true)
    if [ -n "$title" ]; then ok "TMDB: achou \"$title\""; else warn "TMDB não respondeu (token? scripts/setup.sh --reconfigurar)"; fi
  fi
  embed=$(curl -s --max-time 20 "$base/api/streams?id=tt0111161&title=The+Shawshank+Redemption" | json_field embed || true)
  if [ -n "$embed" ]; then
    ok "player: $embed"
  elif [ -n "$(env_get STREAM_MOVIE_URL)" ]; then
    warn "o player não devolveu link pro filme de teste (veja o link com scripts/setup.sh --reconfigurar)"
  else
    info "player sem fonte (sem link nem overlay)"
  fi
}

done_message() {
  printf '\n%s✓ Pronto%s\n' "$GREEN" "$RESET"
  info "Local:        http://127.0.0.1:$PORT"
  [ -n "$TS_URL" ] && info "Tailscale:    $TS_URL  (celular, notebook, qualquer aparelho da tailnet)"
  info "Serviço:      systemctl --user status $SERVICE   ·   logs: journalctl --user -u $SERVICE -f"
  info "Trocar link:  scripts/setup.sh --reconfigurar"
  info "Atualizar:    git pull && scripts/setup.sh"
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

PORT="${MFL_PORT:-$(unit_port)}"
PORT="${PORT:-3100}"

while [ $# -gt 0 ]; do
  case "$1" in
    --overlay) OVERLAY="${2:?--overlay precisa do caminho do zip}"; shift 2 ;;
    --sem-tailscale) WITH_TAILSCALE=0; shift ;;
    --sem-extensao) WITH_EXTENSION=0; shift ;;
    --reconfigurar) RECONFIGURE=1; shift ;;
    --desinstalar) uninstall; exit 0 ;;
    --so-extensao) install_extension; exit 0 ;;
    -h|--help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 0 ;;
    *) echo "Opção desconhecida: $1 (veja --help)" >&2; exit 1 ;;
  esac
done

if [ -n "$OVERLAY" ] && [ ! -f "$OVERLAY" ]; then
  warn "overlay não encontrado: $OVERLAY"
  warn "Ele só é preciso num clone novo, sem os scrapers (gere com scripts/pack-real-scraper.sh"
  warn "no clone que já tem). Neste clone é só rodar sem --overlay."
  exit 1
fi

# --reconfigurar com tudo já instalado: o .env.local é lido na hora de subir, então basta reiniciar.
if [ "$RECONFIGURE" = 1 ] && [ -z "$OVERLAY" ] && [ -f "$UNIT" ] && [ -f .next-prod/standalone/server.js ]; then
  QUICK=1
  TOTAL=3
else
  TOTAL=$((4 + WITH_TAILSCALE + WITH_EXTENSION))
  [ -z "$OVERLAY" ] || TOTAL=$((TOTAL + 1))
fi

step "Conferindo o que precisa"
for cmd in node npm python3 systemctl curl; do
  command -v "$cmd" >/dev/null || { warn "falta o comando '$cmd'"; exit 1; }
done
node_major=$(node -p 'process.versions.node.split(".")[0]')
[ "$node_major" -ge 18 ] || { warn "precisa do Node 18+ (tem $(node -v))"; exit 1; }
ok "node $(node -v), npm $(npm -v)"
choose_port

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

step "Token do TMDB e link do player (.env.local)"
if [ ! -f .env.local ]; then
  cp .env.example .env.local
  info "criado a partir do .env.example"
fi
chmod 600 .env.local
configure_tmdb
configure_links
summary
if ! confirm "Seguir?"; then
  info "Parado aqui. A configuração ficou salva no .env.local; rode de novo quando quiser."
  exit 0
fi

if [ "$QUICK" = 1 ]; then
  step "Reiniciando o serviço"
  start_and_check
  done_message
  exit 0
fi

step "Dependências e build"
quiet "instalando dependências (npm)" npm install --no-audit --no-fund --loglevel=error
quiet "compilando o build de produção" scripts/serve.sh --build

step "Serviço do systemd ($SERVICE)"
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
if loginctl show-user "$USER" -p Linger 2>/dev/null | grep -q '=yes'; then
  ok "sobe no boot, antes do login (linger)"
elif loginctl enable-linger "$USER" 2>/dev/null; then
  ok "linger ligado: sobe no boot, antes do login"
else
  warn "sem linger: o site sobe quando você fizer login (sudo loginctl enable-linger $USER muda isso)"
fi
start_and_check

if [ "$WITH_TAILSCALE" = 1 ]; then
  step "Link pela Tailscale (HTTPS na porta $TS_HTTPS_PORT, só na sua tailnet)"
  if ! command -v tailscale >/dev/null; then
    warn "tailscale não instalado; pulando"
  elif ! tailscale status >/dev/null 2>&1; then
    warn "tailscale desconectado; rode 'tailscale up' e depois este script de novo"
  elif tailscale serve --bg --https="$TS_HTTPS_PORT" "http://127.0.0.1:$PORT" >/dev/null; then
    host=$(tailscale status --json | python3 -I -c 'import json,sys; print(json.load(sys.stdin)["Self"]["DNSName"].rstrip("."))')
    TS_URL="https://$host:$TS_HTTPS_PORT"
    ok "$TS_URL"
  else
    warn "o 'tailscale serve' falhou. Sem permissão? sudo tailscale set --operator=$USER"
    warn "Se ele pedir pra ativar HTTPS na tailnet, abra o link que aparecer e rode de novo."
  fi
fi

if [ "$WITH_EXTENSION" = 1 ]; then
  install_extension
fi

done_message
exit 0
