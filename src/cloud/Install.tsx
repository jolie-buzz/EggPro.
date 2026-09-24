import { useEffect, useId, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Download, Share } from "lucide-react";
interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
function isStandalone() {
  return (
    matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
export function InstallApp() {
  const apple =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const helpId = useId();
  const [prompt, setPrompt] = useState<InstallEvent>(),
    [installed, setInstalled] = useState(isStandalone),
    [help, setHelp] = useState(false);
  useEffect(() => {
    const ready = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallEvent);
    };
    const done = () => setInstalled(true);
    const display = matchMedia("(display-mode: standalone)");
    const update = () => setInstalled(isStandalone());
    display.addEventListener("change", update);
    window.addEventListener("beforeinstallprompt", ready);
    window.addEventListener("appinstalled", done);
    return () => {
      display.removeEventListener("change", update);
      window.removeEventListener("beforeinstallprompt", ready);
      window.removeEventListener("appinstalled", done);
    };
  }, []);
  if (installed || Capacitor.isNativePlatform()) return null;
  return (
    <div className="install-app">
      <button
        className="text-button"
        aria-expanded={help}
        aria-controls={helpId}
        onClick={async () => {
          if (prompt && !apple) {
            try {
              await prompt.prompt();
              await prompt.userChoice;
            } catch {
              setHelp(true);
            } finally {
              setPrompt(undefined);
            }
          } else setHelp(!help);
        }}
      >
        <Download size={16} />{" "}
        {apple
          ? "Install EggPro on iPhone / iPad"
          : "Install EggPro on this phone"}
      </button>
      {help && (
        <section
          id={helpId}
          className="install-guide"
          aria-label="Install EggPro instructions"
        >
          <h2>{apple ? "Add EggPro to your Home Screen" : "Install EggPro"}</h2>
          {apple ? (
            <ol>
              <li>
                Open this website in <strong>Safari</strong>.
              </li>
              <li>
                Tap <Share size={16} aria-hidden="true" />{" "}
                <strong>Share</strong> in the browser toolbar. If needed, open
                the More menu first.
              </li>
              <li>
                Choose <strong>Add to Home Screen</strong>. Scroll down the
                share menu if you do not see it.
              </li>
              <li>
                If shown, leave <strong>Open as Web App</strong> turned on, then
                tap <strong>Add</strong>.
              </li>
              <li>
                Open the <strong>EggPro</strong> icon on your Home Screen.
              </li>
            </ol>
          ) : (
            <p>
              On Android, open the browser menu and choose Install app or Add to
              Home screen. On iPhone, open in Safari and choose Share → Add to
              Home Screen.
            </p>
          )}
          <p className="hint">
            Once cloud setup is complete, sign in from the installed app while
            online to download your farm. You can then keep recording offline.
            Reopen EggPro with internet to sync saved changes. Only synced
            records are available on another phone.
          </p>
        </section>
      )}
    </div>
  );
}
