import type { ApiViewFile } from '../types';

const DRAFT_KEY = 'apiview_draft';

export function saveDraft(flow: ApiViewFile) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(flow));
  } catch { /* storage full, ignore */ }
}

export function loadDraft(): ApiViewFile | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

export function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}
