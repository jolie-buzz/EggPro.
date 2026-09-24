import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Sprout, ShieldCheck, LogOut, RefreshCw, Download } from "lucide-react";
import { supabase, localMode } from "./client";
import { accountStore } from "./store";
import { openCloudDatabase, type CloudDatabase } from "./database";
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
export function Root() {
  const [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(true),
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
      setSession(next);
      setLoading(false);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) setError(error.message);
        setSession(data.session);
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
  if (localMode) return <App />;
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
                { redirectTo: location.origin + "/" },
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
                options: { emailRedirectTo: location.origin + "/" },
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
  const [connection, setConnection] = useState<CloudDatabase>(),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [reloadKey, setReloadKey] = useState(0),
    [busy, setBusy] = useState(false),
    [updates, setUpdates] = useState(false),
    [online, setOnline] = useState(navigator.onLine),
    [importing, setImporting] = useState(false);
  useEffect(() => {
    let active = true,
      opened: CloudDatabase | undefined;
    import("sql.js")
      .then(async ({ default: init }) => {
        const SQL = await init({
          locateFile: () => new URL("sql-wasm.wasm", document.baseURI).href,
        });
        opened = await openCloudDatabase(
          SQL,
          accountStore(supabase!, session.user.id),
        );
        if (active) setConnection(opened);
        else opened.dispose();
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      });
    return () => {
      active = false;
      opened?.dispose();
    };
  }, [session.user.id]);
  useEffect(() => {
    const connectivity = () => setOnline(navigator.onLine);
    const check = () => {
      if (
        connection &&
        document.visibilityState === "visible" &&
        navigator.onLine
      )
        void connection
          .checkForUpdates()
          .then(setUpdates)
          .catch(() => {});
    };
    window.addEventListener("online", connectivity);
    window.addEventListener("offline", connectivity);
    window.addEventListener("focus", check);
    const timer = setInterval(check, 30000);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", connectivity);
      window.removeEventListener("offline", connectivity);
      window.removeEventListener("focus", check);
    };
  }, [connection]);
  async function signOut() {
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
      setNotice("Latest farm records loaded.");
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
          {online ? "Online farm" : "Offline · reconnect to save"}
        </strong>
        <small>{session.user.email}</small>
      </div>
      <div className="actions">
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
          <RefreshCw size={16} /> Reload farm
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
        <h1>Couldn’t open your online farm</h1>
        <p role="alert">{error}</p>
        <button onClick={() => location.reload()}>Try again</button>
        {toolbar}
      </main>
    );
  if (!connection)
    return (
      <main className="loading">
        <Brand />
        <p>Opening your online farm…</p>
      </main>
    );
  const controls = (
    <>
      {toolbar}
      {updates && (
        <p className="notice" role="status">
          New changes are available from another phone. Use Reload farm before
          entering more records.
        </p>
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
