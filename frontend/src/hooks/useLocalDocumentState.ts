import { useCallback, useMemo, useState } from 'react';

const ARCHIVED_KEY = 'comptabli-archived-document-ids';
const HIDDEN_KEY = 'comptabli-hidden-document-ids-session';

function readJsonArray(storage: Storage, key: string): string[] {
  try {
    const raw = storage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** IDs archivés (persistés) — affichés dans Archives, masqués dans Mon espace. */
export function useArchivedDocumentIds() {
  const [ids, setIds] = useState<string[]>(() => readJsonArray(localStorage, ARCHIVED_KEY));

  const persist = useCallback((next: string[]) => {
    setIds(next);
    localStorage.setItem(ARCHIVED_KEY, JSON.stringify(next));
  }, []);

  const archive = useCallback(
    (id: string) => {
      if (ids.includes(id)) return;
      persist([...ids, id]);
    },
    [ids, persist],
  );

  const unarchive = useCallback(
    (id: string) => {
      persist(ids.filter((x) => x !== id));
    },
    [ids, persist],
  );

  const refresh = useCallback(() => {
    setIds(readJsonArray(localStorage, ARCHIVED_KEY));
  }, []);

  const set = useMemo(() => new Set(ids), [ids]);
  return {
    archivedIds: set,
    archive,
    unarchive,
    refresh,
  };
}

/** Suppression « locale » (session) — pas d’endpoint DELETE côté API. */
export function useHiddenDocumentIds() {
  const [ids, setIds] = useState<string[]>(() => readJsonArray(sessionStorage, HIDDEN_KEY));

  const persist = useCallback((next: string[]) => {
    setIds(next);
    sessionStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
  }, []);

  const hide = useCallback(
    (id: string) => {
      if (ids.includes(id)) return;
      persist([...ids, id]);
    },
    [ids, persist],
  );

  const set = useMemo(() => new Set(ids), [ids]);
  return { hiddenIds: set, hide };
}
