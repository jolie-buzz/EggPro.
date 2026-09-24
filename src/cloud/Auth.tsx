import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Sprout, ShieldCheck, LogOut, RefreshCw, Download } from "lucide-react";
import { supabase, localMode } from "./client";
import { accountStore } from "./store";
import {
  openOfflineDatabase,
  type OfflineDatabase,
  type SyncStatus,
} from "./offline";
import { accountCache } from "./local-cache";
import { Capacitor } from "@capacitor/core";
import { shareBackup } from "../services/backup";
import { App } from "../App";
import { Backup } from "../pages/Settings";
import { Card, Field, Form, str, errorMessage } from "../components/ui";
import { InstallApp } from "./Install";
function Brand() {
  return (
    <div className="brand">
      <Sprout /> EggPro
    </div>
  );
}
// This cached identity only unlocks the same device's local copy. Supabase still
// validates its real token on every cloud request; an expired token cannot sync.
function cachedSession(): Session | null {
  try {
    const value = JSON.parse(localStorage.getItem("eggpro-auth") ?? "null");
    return value?.user?.id && value?.access_token ? (value as Session) : null;
  } catch {
    return null;
  }
}
export function Root() {
  const [session, setSession] = useState<Session | null>(cachedSession),
    [loading, setLoading] = useState(!cachedSession()),
    [recovery, setRecovery] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let mounted = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      if (!mounted) return;
      setSession(next ?? (event === "SIGNED_OUT" ? null : cachedSession()));
      setLoading(false);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) setError(error.message);
        setSession(data.session ?? (error ? cachedSession() : null));
        setLoading(false);
      })
      .catch(() => {
        if (mounted) {
          setError("Could not restore your session. Please try again.");
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);
  if (localMode || (!supabase && Capacitor.isNativePlatform()))
    return (
      <App
        deviceNotice={
          !supabase && Capacitor.isNativePlatform()
            ? "Offline edition · Cloud backup is not connected yet. Records are saved on this phone."
            : undefined
        }
      />
    );
  if (!supabase)
    return (
      <main className="setup">
        <Brand />
        <h1>EggPro is getting ready</h1>
        <p>
          The online connection has not been configured yet. Your farm records
          have not been changed.
        </p>
        <p>Deployment requires the Supabase project URL and publishable key.</p>
      </main>
    );
  if (loading)
    return (
      <main className="loading">
        <Brand />
        <p>Restoring your session…</p>
      </main>
    );
  if (recovery && session)
    return (
      <main className="setup">
        <Brand />
        <h1>Choose a new password</h1>
        <Form
          label="Update password"
          onSave={async (d) => {
            const { error } = await supabase!.auth.updateUser({
              password: str(d, "password"),
            });
            if (error) throw error;
            setRecovery(false);
          }}
        >
          <Field label="New password">
            <input
              name="password"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
            />
          </Field>
        </Form>
      </main>
    );
  if (!session) return <AuthScreen initialError={error} />;
  return <OnlineFarm key={session.user.id} session={session} />;
}
function AuthScreen({ initialError }: { initialError: string }) {
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login"),
    [message, setMessage] = useState(initialError);
  return (
    <main className="setup auth-screen">
      <Brand />
      <span className="eyebrow">YOUR FARM, WITH YOU</span>
      <h1>
        {mode === "login"
          ? "Welcome back."
          : mode === "signup"
            ? "Your farm starts here."
            : "Reset your password."}
      </h1>
      <p className="lead">
        {mode === "login"
          ? "Sign in to open your farm on this phone."
          : mode === "signup"
            ? "One account for your records, on every phone."
            : "We’ll email you a link to choose a new password."}
      </p>
      <Card>
        <Form
          key={mode}
          label={
            mode === "login"
              ? "Sign in"
              : mode === "signup"
                ? "Create account"
                : "Send reset link"
          }
          onSave={async (d) => {
            setMessage("");
            const email = str(d, "email");
            if (mode === "reset") {
              const { error } = await supabase!.auth.resetPasswordForEmail(
                email,
                Capacitor.isNativePlatform()
                  ? undefined
                  : { redirectTo: location.origin + "/" },
              );
              if (error) throw error;
              setMessage(
                "If this email has an account, a reset link will arrive shortly.",
              );
              return;
            }
            const password = str(d, "password");
            if (mode === "signup") {
              const { data, error } = await supabase!.auth.signUp({
                email,
                password,
                options: {
                  emailRedirectTo: Capacitor.isNativePlatform()
                    ? undefined
                    : location.origin + "/",
                },
              });
              if (error) throw error;
              if (!data.session)
                setMessage(
                  "Check your email to confirm your account, then return here to sign in.",
                );
            } else {
              const { error } = await supabase!.auth.signInWithPassword({
                email,
                password,
              });
              if (error) throw error;
            }
          }}
        >
          <Field label="Email">
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
            />
          </Field>
          {mode !== "reset" && (
            <Field label="Password">
              <input
                name="password"
                type="password"
                required
                minLength={mode === "signup" ? 8 : 1}
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
              />
            </Field>
          )}
          {mode === "signup" && (
            <p className="hint">
              Use at least 8 characters. Keep this account for the phones that
              access your farm.
            </p>
          )}
        </Form>
        {message && (
          <p role="status" className="notice">
            {message}
          </p>
        )}
        <div className="auth-links">
          <button
            className="text-button"
            onClick={() => {
              setMode(mode === "signup" ? "login" : "signup");
              setMessage("");
            }}
          >
            {mode === "signup"
              ? "Already have an account? Sign in"
              : "Create an account"}
          </button>
          <button
            className="text-button"
            onClick={() => {
              setMode(mode === "reset" ? "login" : "reset");
              setMessage("");
            }}
          >
            {mode === "reset" ? "Back to sign in" : "Forgot password?"}
          </button>
        </div>
      </Card>
      <p className="privacy">
        <ShieldCheck size={18} /> Stay signed in on this device until you log
        out. Use your own phone.
      </p>
      <InstallApp />
    </main>
  );
}
function OnlineFarm({ session }: { session: Session }) {
  const [connection, setConnection] = useState<OfflineDatabase>(),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [reloadKey, setReloadKey] = useState(0),
    [busy, setBusy] = useState(false),
    [updates, setUpdates] = useState(false),
    [online, setOnline] = useState(navigator.onLine),
    [importing, setImporting] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let active = true,
      opened: OfflineDatabase | undefined;
    import("sql.js")
      .then(async ({ default: init }) => {
        const SQL = await init({
          locateFile: () => new URL("sql-wasm.wasm", document.baseURI).href,
        });
        opened = await openOfflineDatabase(
          SQL,
          accountStore(supabase!, session.user.id),
          accountCache(session.user.id, import.meta.env.VITE_SUPABASE_URL),
          controller.signal,
        );
        if (active) setConnection(opened);
        else opened.dispose();
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      });
    return () => {
      active = false;
      controller.abort();
      opened?.dispose();
    };
  }, [session.user.id]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>();
  useEffect(() => {
    if (!connection) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sync = () => {
      if (navigator.onLine && document.visibilityState === "visible")
        void connection.sync();
    };
    const update = () => {
      const status = connection.status();
      setSyncStatus(status);
      setUpdates(status.updates);
      if (
        status.pending &&
        !status.syncing &&
        !status.conflict &&
        navigator.onLine
      ) {
        clearTimeout(timer);
        timer = setTimeout(sync, 5000);
      }
    };
    const connectivity = () => {
      setOnline(navigator.onLine);
      sync();
    };
    const unsubscribe = connection.subscribe(update);
    update();
    sync();
    const interval = setInterval(sync, 30000);
    window.addEventListener("online", connectivity);
    window.addEventListener("offline", connectivity);
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      unsubscribe();
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener("online", connectivity);
      window.removeEventListener("offline", connectivity);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [connection]);
  async function signOut() {
    if (
      connection?.status().pending &&
      !confirm(
        "This phone has records waiting to sync. They will stay on this phone under this account, but are not backed up online yet. Log out anyway?",
      )
    )
      return;
    setBusy(true);
    try {
      const { error } = await supabase!.auth.signOut({ scope: "local" });
      if (error) throw error;
    } catch (e) {
      setNotice(errorMessage(e));
      setBusy(false);
    }
  }
  async function reload() {
    if (!connection) return;
    setBusy(true);
    try {
      await connection.reload();
      setReloadKey((k) => k + 1);
      setUpdates(false);
      setNotice(
        "Latest cloud records loaded. Saved phone changes were preserved.",
      );
    } catch (e) {
      setNotice(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const toolbar = (
    <div className="cloud-toolbar">
      <div>
        <strong>
          {syncStatus?.syncing
            ? "Syncing…"
            : syncStatus?.conflict
              ? "Sync needs review"
              : syncStatus?.pending
                ? "Saved on phone · waiting to sync"
                : online && syncStatus?.lastSynced
                  ? "Saved on phone & cloud"
                  : online
                    ? "Saved on phone"
                    : "Offline · records saved on phone"}
        </strong>
        <small>{session.user.email}</small>
      </div>
      <div className="actions">
        <button
          disabled={busy || !connection || !online || syncStatus?.syncing}
          onClick={() => void connection?.sync()}
        >
          <RefreshCw size={16} /> Sync now
        </button>
        <button
          disabled={busy || !connection}
          onClick={() => {
            if (
              confirm(
                "Reload the latest farm records? Unsaved form entries will be cleared.",
              )
            )
              void reload();
          }}
        >
          <RefreshCw size={16} /> Reload cloud copy
        </button>
        <button disabled={busy} onClick={() => void signOut()}>
          <LogOut size={16} /> Log out
        </button>
      </div>
    </div>
  );
  if (error)
    return (
      <main className="setup">
        <Brand />
        <h1>Couldn’t open your farm</h1>
        <p role="alert">{error}</p>
        <button onClick={() => location.reload()}>Try again</button>
        {toolbar}
      </main>
    );
  if (!connection)
    return (
      <main className="loading">
        <Brand />
        <p>Opening your saved farm…</p>
      </main>
    );
  const controls = (
    <>
      {toolbar}
      {updates && (
        <p className="notice" role="status">
          New changes are available from another phone. Use Reload cloud copy
          before entering more records.
        </p>
      )}
      {syncStatus && (
        <p className="hint" role="status">
          {syncStatus.message}
          {syncStatus.lastSynced
            ? ` · Last synced ${new Date(syncStatus.lastSynced).toLocaleString()}`
            : " · No cloud backup yet"}
        </p>
      )}
      {connection && syncStatus?.conflict && (
        <Card>
          <h2>Two farm versions need review</h2>
          <p>
            This phone and another phone have changed the farm. Nothing has been
            overwritten. Export both copies before deciding which whole farm
            version to continue with.
          </p>
          <div className="actions">
            <button onClick={() => void shareBackup(connection.copies().phone)}>
              Export phone version
            </button>
            <button
              onClick={() => {
                const cloud = connection.copies().cloud;
                if (cloud) void shareBackup(cloud);
              }}
            >
              Export cloud version
            </button>
            {(["phone", "cloud"] as const).map((choice) => (
              <button
                key={choice}
                disabled={busy || !online}
                onClick={async () => {
                  if (
                    !confirm(
                      `Use the entire ${choice} version? These versions are not merged. Both copies will be kept in Recovery backups on this phone.`,
                    )
                  )
                    return;
                  setBusy(true);
                  try {
                    await connection.resolve(choice);
                    setReloadKey((k) => k + 1);
                  } catch (e) {
                    setNotice(errorMessage(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Use {choice} version
              </button>
            ))}
          </div>
        </Card>
      )}
      {connection && connection.copies().recovery.length > 0 && (
        <details>
          <summary>Recovery backups</summary>
          {connection.copies().recovery.map((copy, i) => (
            <button key={i} onClick={() => void shareBackup(copy.document)}>
              {copy.label} · {new Date(copy.date).toLocaleString()}
            </button>
          ))}
        </details>
      )}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      <InstallApp />
    </>
  );
  return (
    <>
      {importing ? (
        <main className="setup">
          {controls}
          <Backup
            db={connection.db}
            cloud
            importOnly
            refresh={async () => {
              setImporting(false);
              setReloadKey((k) => k + 1);
            }}
            back={() => setImporting(false)}
          />
        </main>
      ) : (
        <App
          key={reloadKey}
          database={connection.db}
          cloud
          accountControls={controls}
          deviceNotice={
            syncStatus?.conflict
              ? "Sync needs review. Open Account & sync; both farm versions are safe."
              : syncStatus?.pending
                ? "Saved on phone · waiting to sync"
                : !online
                  ? "Offline · you can keep recording"
                  : undefined
          }
          setupActions={
            <button onClick={() => setImporting(true)}>
              <Download size={18} /> Import backup from the offline app
            </button>
          }
        />
      )}
    </>
  );
}
