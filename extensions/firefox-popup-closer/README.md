# Fecha popups do player (Firefox / Zen)

Players embutidos no My Film List costumam abrir uma aba de anúncio a cada clique. Essa extensão
fecha essas abas assim que abrem e devolve o foco pro app — o mesmo que apertar Ctrl+W, só que
automático. Só age em abas abertas **por um iframe** dentro de uma aba do My Film List; links do
próprio app abrem normalmente.

Se o app não roda em `localhost:3000`, ajuste `APP_URLS` em `background.js`.

## Instalar

**Automático (Zen):** `scripts/setup.sh --so-extensao` na raiz do repo. Coloca a extensão nos perfis
do Zen e, se ele estiver aberto, abre o `about:profiles` pra você clicar em "Reiniciar normalmente…"
(as abas voltam); depois confirma que ela ficou ativa.

**Temporário (some ao fechar o navegador):** `about:debugging#/runtime/this-firefox` →
"Carregar extensão temporária…" → selecione `manifest.json` desta pasta.

**Permanente:** o Firefox só instala extensões assinadas. Dá pra assinar de graça como "unlisted"
(não fica pública na loja) com uma conta no addons.mozilla.org:

```bash
cd extensions/firefox-popup-closer
npx web-ext sign --channel=unlisted --api-key=SEU_JWT_ISSUER --api-secret=SEU_JWT_SECRET
```

As chaves ficam em https://addons.mozilla.org/developers/addon/api/key/. O `.xpi` gerado em
`web-ext-artifacts/` instala arrastando pro navegador.
