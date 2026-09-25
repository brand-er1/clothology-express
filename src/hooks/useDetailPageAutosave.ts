import { useCallback, useEffect, useRef, useState } from "react";
import { saveDetailPage, getDetailPageErrorMessage } from "@/services/detailPage";
import type {
  DetailPageDocument,
  DetailPageGenerationMeta,
  DetailPageSource,
  DetailPageStatus,
} from "@/types/detailPage";

export type AutosaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

type Snapshot = {
  document: DetailPageDocument;
  source: DetailPageSource;
  generation: DetailPageGenerationMeta;
};

type LocalBackup = Snapshot & { editedAt: number; synced: boolean };

const AUTOSAVE_DELAY_MS = 1200;
const backupKey = (pageId: string) => `brander:detail-page-draft:${pageId}`;

const writeBackup = (pageId: string, backup: LocalBackup) => {
  try {
    localStorage.setItem(backupKey(pageId), JSON.stringify(backup));
  } catch {
    // Private mode / quota: Supabase autosave still runs.
  }
};

/**
 * Returns an unsynced local copy newer than the server version, if the last session ended
 * before its edits reached Supabase (offline, closed tab mid-save).
 */
export const readUnsyncedBackup = (pageId: string, serverUpdatedAt: string): Snapshot | null => {
  try {
    const raw = localStorage.getItem(backupKey(pageId));
    if (!raw) return null;
    const backup = JSON.parse(raw) as LocalBackup;
    if (backup.synced || !backup.document?.sections) return null;
    return backup.editedAt > new Date(serverUpdatedAt).getTime() ? backup : null;
  } catch {
    return null;
  }
};

/**
 * Debounced autosave: every change is backed up locally at once and saved to Supabase
 * (`save_product_detail_page`) after a short pause. Only one save runs at a time; edits made
 * during a save trigger another save afterwards.
 */
export const useDetailPageAutosave = (pageId: string | null, snapshot: Snapshot | null) => {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef<Snapshot | null>(snapshot);
  const baseline = useRef<string | null>(null);
  const timer = useRef<number | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  latest.current = snapshot;

  const serialized = snapshot ? JSON.stringify(snapshot) : null;

  /** Saves the latest snapshot. Saves are queued so only one request runs at a time. */
  const persist = useCallback(
    (nextStatus?: Exclude<DetailPageStatus, "linked">): Promise<void> => {
      const task = queue.current.then(async () => {
        if (!pageId || !latest.current) return;
        const current = latest.current;
        const currentSerialized = JSON.stringify(current);
        if (!nextStatus && currentSerialized === baseline.current) return;
        setStatus("saving");
        setError(null);
        try {
          await saveDetailPage({ id: pageId, ...current, status: nextStatus });
          baseline.current = currentSerialized;
          setLastSavedAt(new Date());
          writeBackup(pageId, { ...current, editedAt: Date.now(), synced: true });
          const changedDuringSave = latest.current && JSON.stringify(latest.current) !== currentSerialized;
          setStatus(changedDuringSave ? "dirty" : "saved");
        } catch (saveError) {
          console.error("Detail page autosave failed:", saveError);
          setError(getDetailPageErrorMessage(saveError, "저장하지 못했습니다."));
          setStatus("error");
          throw saveError;
        }
      });
      queue.current = task.catch(() => undefined);
      return task;
    },
    [pageId],
  );

  // First snapshot after load is the baseline, not an edit.
  useEffect(() => {
    if (!pageId || serialized === null) return;
    if (baseline.current === null) {
      baseline.current = serialized;
      return;
    }
    if (serialized === baseline.current) return;
    writeBackup(pageId, { ...(JSON.parse(serialized) as Snapshot), editedAt: Date.now(), synced: false });
    setStatus((current) => (current === "saving" ? current : "dirty"));
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void persist().catch(() => undefined);
    }, AUTOSAVE_DELAY_MS);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [pageId, persist, serialized]);

  // Warn before leaving with unsaved edits (they are still backed up locally).
  useEffect(() => {
    if (status !== "dirty" && status !== "saving" && status !== "error") return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [status]);

  const saveNow = useCallback(
    async (nextStatus?: Exclude<DetailPageStatus, "linked">) => {
      if (timer.current) window.clearTimeout(timer.current);
      await persist(nextStatus);
    },
    [persist],
  );

  /** Marks the given snapshot as already saved (e.g. right after loading or creating). */
  const resetBaseline = useCallback((next: Snapshot) => {
    baseline.current = JSON.stringify(next);
    setStatus("idle");
  }, []);

  return { status, lastSavedAt, error, saveNow, resetBaseline };
};
