export const SEARCH_LOADING_MESSAGES = [
  "Vasculhando os arquivos secretos...",
  "Acordando o robô buscador...",
  "Perguntando pro oráculo dos filmes...",
  "Fuçando prateleiras empoeiradas...",
  "Invocando o algoritmo cinéfilo...",
  "Rastreando pistas nos bastidores...",
  "Desenrolando a fita cassete...",
  "Sacudindo a poeira dos arquivos...",
  "Consultando o crítico interno...",
  "Abrindo o cofre dos clássicos...",
];

export function randomLoadingMessage(): string {
  const i = Math.floor(Math.random() * SEARCH_LOADING_MESSAGES.length);
  return SEARCH_LOADING_MESSAGES[i];
}
