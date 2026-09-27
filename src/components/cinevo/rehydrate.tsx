import { useEffect } from "react";
import { useCinevo } from "@/lib/cinevo-store";
import { restoreFolderBlobs } from "@/lib/folder-handles";

const STALE_KEYS = ["cinevo-state", "cinevo-storage", "cinevo-local-v2", "cinevo-local-v3"];

export function Rehydrate() {
  useEffect(() => {
    try {
      for (const key of STALE_KEYS) localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    void Promise.resolve(useCinevo.persist.rehydrate())
      .then(async () => {
        const theme = useCinevo.getState().prefs.theme || "day";
        document.documentElement.setAttribute("data-theme", theme);
        const restored = await restoreFolderBlobs();
        if (restored) {
          const s = useCinevo.getState();
          useCinevo.setState({ localTitles: [...s.localTitles] });
        }
      })
      .finally(() => {
        useCinevo.setState({ hydrated: true });
      });
  }, []);
  return null;
}
