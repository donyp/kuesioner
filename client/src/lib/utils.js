export function cn(...classes) { return classes.filter(Boolean).join(' '); }

export function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

export function downloadUrl(path) { return path; }