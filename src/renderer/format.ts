import type { SourceView } from '../shared/types';

export function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatDate(value: string | null): string {
  if (!value) {
    return 'Never';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Invalid date';
  }

  return date.toLocaleString(undefined, {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function sortSourcesByNewVersionDesc(sources: SourceView[]): SourceView[] {
  return [...sources].sort((a, b) => {
    const aTs = a.lastChangeType === 'update' ? Date.parse(a.lastChangeAt || '') || 0 : 0;
    const bTs = b.lastChangeType === 'update' ? Date.parse(b.lastChangeAt || '') || 0 : 0;

    if (aTs !== bTs) {
      return bTs - aTs;
    }

    return a.name.localeCompare(b.name);
  });
}
