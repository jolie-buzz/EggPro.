import {
  useState,
  useEffect,
  useRef,
  type ReactNode,
  type FormEvent,
} from "react";
import { ArrowLeft, X, Sprout } from "lucide-react";
export function Heading({
  title,
  subtitle,
  action,
  back,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  back?: () => void;
}) {
  return (
    <header className="page-heading">
      <div>
        {back && (
          <button className="back" onClick={back}>
            <ArrowLeft size={18} /> Back
          </button>
        )}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`card ${className}`}>{children}</section>;
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Empty({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Sprout size={32} />
      <h3>{title}</h3>
      {detail && <p>{detail}</p>}
      {action}
    </div>
  );
}
export function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
}) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}
export function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLElement>(null),
    closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current
      ?.querySelector<HTMLElement>("input,select,button,textarea")
      ?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
      }
      if (e.key === "Tab") {
        const elements = [
          ...(ref.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
          ) ?? []),
        ].filter((el) => el.offsetParent !== null);
        const first = elements[0],
          last = elements.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop">
      <section
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal"
      >
        <header>
          <h2>{title}</h2>
          <button
            type="button"
            className="icon"
            aria-label="Close"
            onClick={close}
          >
            <X />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
export function Form({
  children,
  onSave,
  label = "Save",
  className = "",
}: {
  children: ReactNode;
  onSave: (data: FormData) => Promise<void>;
  label?: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const data = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await onSave(data);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className={className}>
      {children}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="primary full" disabled={busy}>
        {busy ? "Saving…" : label}
      </button>
    </form>
  );
}
export function errorMessage(e: unknown) {
  if (e && typeof e === "object" && "issues" in e)
    return (e.issues as { message: string; path: unknown[] }[])
      .map((i) => `${i.path.join(" ")}: ${i.message}`)
      .join(". ");
  const message = e instanceof Error ? e.message : String(e);
  if (message.includes("UNIQUE constraint failed: cages.cage_number"))
    return "This cage number already exists. Choose a different number.";
  return message;
}
export const str = (d: FormData, key: string) =>
  String(d.get(key) ?? "").trim();
export const num = (d: FormData, key: string) => Number(d.get(key));
export function NumberField({
  label,
  name,
  value = 0,
  min = 0,
  step = "1",
  required = true,
}: {
  label: string;
  name: string;
  value?: number;
  min?: number;
  step?: string;
  required?: boolean;
}) {
  return (
    <Field label={label}>
      <input
        name={name}
        type="number"
        inputMode={step === "1" ? "numeric" : "decimal"}
        min={min}
        step={step}
        defaultValue={value}
        required={required}
      />
    </Field>
  );
}
