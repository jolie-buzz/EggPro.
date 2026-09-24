import { useEffect, useState } from "react";
import { Download } from "lucide-react";
interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallEvent>(),
    [installed, setInstalled] = useState(
      matchMedia("(display-mode: standalone)").matches,
    ),
    [help, setHelp] = useState(false);
  useEffect(() => {
    const ready = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallEvent);
    };
    const done = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", ready);
    window.addEventListener("appinstalled", done);
    return () => {
      window.removeEventListener("beforeinstallprompt", ready);
      window.removeEventListener("appinstalled", done);
    };
  }, []);
  if (installed) return null;
  return (
    <div className="install-app">
      <button
        className="text-button"
        onClick={async () => {
          if (prompt) {
            await prompt.prompt();
            await prompt.userChoice;
            setPrompt(undefined);
          } else setHelp(!help);
        }}
      >
        <Download size={16} /> Install EggPro on this phone
      </button>
      {help && (
        <p className="hint">
          iPhone: open this site in Safari, tap Share, then Add to Home Screen.
          Android: open the browser menu and choose Install app or Add to Home
          screen. Sign in with the same account on each phone. Internet is
          required to load and save farm records.
        </p>
      )}
    </div>
  );
}
