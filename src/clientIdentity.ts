export function agentName(name?: string): string {
  const raw = (name ?? '').trim();
  const key = raw.toLowerCase().replace(/[ _]/g, '-');
  if (['codex', 'codex-mcp-client', 'codex-cli', 'codex-desktop'].includes(key)) return 'Codex';
  if (['claude-code', 'claude-ai', 'claude', 'claude-code-mcp-client'].includes(key)) return 'Claude Code';
  return [...raw.replace(/[^\p{L}\p{N} ._-]/gu, '')].slice(0, 64).join('').trim() || 'AI Agent';
}
