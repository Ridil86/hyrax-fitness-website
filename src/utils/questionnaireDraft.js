/**
 * Lightweight sessionStorage persistence for multi-step questionnaires.
 * Keyed by user identity + form name to avoid cross-user bleed in shared
 * browsers (sessionStorage is per-tab, but tabs can be duplicated).
 */

function draftKey(formName, userKey) {
  return `hyrax-draft:${formName}:${userKey || 'anon'}`;
}

export function loadDraft(formName, userKey) {
  try {
    const raw = sessionStorage.getItem(draftKey(formName, userKey));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveDraft(formName, userKey, data) {
  try {
    sessionStorage.setItem(draftKey(formName, userKey), JSON.stringify(data));
  } catch {
    // quota or serialization failure - skip silently
  }
}

export function clearDraft(formName, userKey) {
  try {
    sessionStorage.removeItem(draftKey(formName, userKey));
  } catch {
    // noop
  }
}
