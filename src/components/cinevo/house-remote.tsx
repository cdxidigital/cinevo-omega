import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { closeHouseRemote, formatHouseCode, readHouseCode, rotateHouseRemote, writeHouseCode } from "@/lib/remote-client";
import { PhoneApps } from "./installers";

export const REMOTE_APK = "/installers/CINEVO-Remote.apk";

export function HouseRemote() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const read = () => setCode(readHouseCode());
    read();
    window.addEventListener("cinevo-house-code", read);
    return () => window.removeEventListener("cinevo-house-code", read);
  }, []);

  const rotate = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await rotateHouseRemote();
      if (!res.ok || !res.code) {
        setError(res.error || "Could not start a new code.");
        return;
      }
      writeHouseCode(res.code);
    } catch {
      setError("Could not reach CINEVO.");
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    setBusy(true);
    if (code) await closeHouseRemote(code).catch(() => undefined);
    writeHouseCode("");
    setBusy(false);
  };

  return (
    <div className="tool-card remote-card">
      <p className="font-ui text-xs font-semibold tracking-[0.12em] text-cine-cyan">PHONE REMOTE</p>
      <h2>Control this house</h2>
      <p>
        Open the remote on a phone, enter this code, and it can play, pause, and seek titles already in this library.
        Playback stays on this screen. The code is the key — rotate it if someone else had it.
      </p>
      {code ? (
        <p className="remote-code" aria-live="polite">
          {formatHouseCode(code)}
        </p>
      ) : (
        <p className="tool-empty">The remote starts when this house is open. Refresh if a code does not appear.</p>
      )}
      {error ? <p className="text-sm text-cine-danger">{error}</p> : null}
      <div className="remote-card__actions">
        <button type="button" className="house-btn" disabled={busy} onClick={() => void rotate()}>
          New code
        </button>
        <button type="button" className="house-btn house-btn--ghost" disabled={busy || !code} onClick={() => void stop()}>
          Stop remote
        </button>
        <a className="house-btn house-btn--ghost" href="/remote">
          <Smartphone size={16} /> Open remote
        </a>
      </div>
      <PhoneApps />
      <p className="remote-card__note">
        A phone cannot open a localhost address. Use the computer’s address on your network. The remote never receives file paths or stream links.
      </p>
    </div>
  );
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferred: BeforeInstallPromptEvent | null = null;

// eslint-disable-next-line react-refresh/only-export-components
export function rememberInstallPrompt(event: BeforeInstallPromptEvent) {
  deferred = event;
  window.dispatchEvent(new Event("cinevo-install"));
}

export function InstallCinevo({ compact = false }: { compact?: boolean }) {
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const sync = () => setReady(Boolean(deferred));
    sync();
    window.addEventListener("cinevo-install", sync);
    return () => window.removeEventListener("cinevo-install", sync);
  }, []);

  if (installed) return null;

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => undefined);
    deferred = null;
    setReady(false);
  };

  return (
    <div className={compact ? "install-note" : "tool-card remote-card"}>
      {!compact ? <p className="font-ui text-xs font-semibold tracking-[0.12em] text-cine-cyan">MOBILE APP</p> : null}
      {!compact ? <h2>Add CINEVO to this phone</h2> : null}
      <p>
        {ios
          ? "In Safari, tap Share, then Add to Home Screen. On the newest iOS, tap the puzzle icon in the bar first, then Share. Or install the CINEVO profile below."
          : ready
            ? "Install the house on this device. It uses the same sign-in and the library you already imported."
            : "In Chrome or Edge, use the browser menu and choose Install app. Android can also sideload the remote."}
      </p>
      {ready ? (
        <button type="button" className="house-btn" onClick={() => void install()}>
          Install app
        </button>
      ) : null}
    </div>
  );
}
