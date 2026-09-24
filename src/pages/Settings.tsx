import { useState } from "react";
import { Download, Upload, ShieldCheck } from "lucide-react";
import type { State } from "../types/models";
import type { FarmRepository } from "../repositories/farm";
import type { Database } from "../database/database";
import { BackupService, shareBackup, validateBackup } from "../services/backup";
import { loadDemo } from "../services/demo";
import {
  Card,
  Heading,
  Field,
  Form,
  NumberField,
  errorMessage,
  str,
  num,
} from "../components/ui";
import { cents } from "../utils/calculations";
export function Settings({
  state,
  farm,
  refresh,
  back,
}: {
  state: State;
  farm: FarmRepository;
  refresh: () => Promise<void>;
  back: () => void;
}) {
  const [message, setMessage] = useState("");
  const prices = JSON.parse(state.settings.prices) as Record<string, number>;
  return (
    <>
      <Heading
        title="Farm settings"
        subtitle="Make FarmTrack your own."
        back={back}
      />
      <Card>
        <Form
          label="Save settings"
          onSave={async (d) => {
            await farm.settings(
              str(d, "name"),
              str(d, "owner"),
              Object.fromEntries(
                state.egg_inventory
                  .map((r) => r.id)
                  .map((s) => [s, cents(num(d, `price:${s}`))]),
              ),
            );
            await refresh();
            setMessage(
              "Settings saved. Historical sale prices and hen counts are unchanged.",
            );
          }}
        >
          <Field label="Farm name">
            <input name="name" defaultValue={state.farms[0].name} required />
          </Field>
          <Field label="Owner name">
            <input name="owner" defaultValue={state.farms[0].owner} />
          </Field>
          <p>
            Currency: <strong>{state.settings.currency}</strong> · fixed for
            this ledger to preserve historical amounts.
          </p>
          <h2>Default egg prices</h2>
          <p>Price per tray · 30 eggs</p>
          <div className="grid2">
            {state.egg_inventory
              .map((r) => r.id)
              .map((s) => (
                <NumberField
                  key={s}
                  label={s}
                  name={`price:${s}`}
                  value={prices[s] / 100}
                  step="0.01"
                />
              ))}
          </div>
        </Form>
        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}
      </Card>
    </>
  );
}
export function Backup({
  db,
  refresh,
  back,
}: {
  db: Database;
  refresh: () => Promise<void>;
  back: () => void;
}) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [pending, setPending] = useState<{
      text: string;
      name: string;
      date: string;
    } | null>(null);
  const backup = new BackupService(db);
  async function run(action: () => Promise<void>, success: string) {
    setBusy(true);
    setMessage("");
    try {
      await action();
      setMessage(success);
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        title="Backup & restore"
        subtitle="Your farm data belongs to you."
        back={back}
      />
      <Card>
        <ShieldCheck size={30} className="good" />
        <h2>Keep a copy somewhere safe</h2>
        <p>
          Export all farm records to one JSON file. On iPhone, use the share
          sheet to save to Files, AirDrop, or iCloud Drive. No cloud account is
          required by FarmTrack.
        </p>
        <button
          disabled={busy}
          className="primary full"
          onClick={() =>
            run(async () => {
              await shareBackup(await backup.export());
            }, "Backup prepared. Complete Save or Share in the system dialog to keep your copy.")
          }
        >
          <Download size={18} /> Export backup
        </button>
        <p className="hint">
          Backups contain customer details and financial records. Keep them in a
          trusted location. The file is not encrypted.
        </p>
      </Card>
      <Card>
        <h2>Restore a backup</h2>
        <p>
          Restoring replaces all data on this device. Export your current data
          first.
        </p>
        <label className="file-button">
          <Upload size={18} /> Choose backup file
          <input
            aria-label="Choose backup file"
            disabled={busy}
            type="file"
            accept=".json,application/json"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              await run(async () => {
                if (file.size > 25 * 1024 * 1024)
                  throw new Error("Backup exceeds 25 MB.");
                const text = await file.text(),
                  data = await validateBackup(text);
                setPending({
                  text,
                  name: String(data.data.farms[0].name),
                  date: data.exportedAt,
                });
              }, "File checked. Review the farm below before replacing your data.");
            }}
          />
        </label>
        {pending && (
          <div className="notice">
            <h3>{pending.name}</h3>
            <p>Exported {new Date(pending.date).toLocaleString()}</p>
            <button
              disabled={busy}
              className="danger"
              onClick={() => {
                if (
                  confirm(
                    `Replace all current farm data with the backup of ${pending.name}? This cannot be undone without your own backup.`,
                  )
                )
                  void run(async () => {
                    await backup.import(pending.text);
                    await refresh();
                    setPending(null);
                  }, "Backup restored successfully.");
              }}
            >
              Replace farm data
            </button>
            <button disabled={busy} onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        )}
      </Card>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
    </>
  );
}
export function Demo({
  db,
  refresh,
  back,
}: {
  db: Database;
  refresh: () => Promise<void>;
  back: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <>
      <Heading
        title="Try sample records"
        back={back}
        subtitle="Optional practice data for a new farm."
      />
      <Card>
        <h2>Explore before you start</h2>
        <p>
          Add seven days of sample collections, feed use, a customer, a sale,
          and expenses to your current cages. Only available before operating
          records have been added.
        </p>
        <p>
          Export a backup of your clean farm first. Restore it when you are
          ready to record real activity.
        </p>
        <button
          className="primary"
          disabled={busy}
          onClick={async () => {
            if (
              !confirm("Add clearly marked demo transactions to this new farm?")
            )
              return;
            setBusy(true);
            try {
              await loadDemo(db);
              await refresh();
              setMessage(
                "Sample records added. Explore Home, Reports, and Sales.",
              );
            } catch (e) {
              setMessage(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Preparing sample records…" : "Add demo records"}
        </button>
        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}
      </Card>
    </>
  );
}
