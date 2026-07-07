export function relativeTime(unixSecs: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixSecs;
  if (diff < 60) return "agora";
  if (diff < 3600) return `há ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  const days = Math.floor(diff / 86400);
  if (days < 30) return `há ${days}d`;
  return new Date(unixSecs * 1000).toLocaleDateString("pt-BR");
}
