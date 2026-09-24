import type { ReactNode } from "react";
import { Sprout, ShieldCheck } from "lucide-react";
import { Card, Field, Form, NumberField, str, num } from "../components/ui";
import type { FarmRepository } from "../repositories/farm";
import { sizes } from "../utils/calculations";
export function Setup({
  farm,
  done,
  cloud = false,
  actions,
}: {
  cloud?: boolean;
  actions?: ReactNode;
  farm: FarmRepository;
  done: () => Promise<void>;
}) {
  return (
    <main className="setup">
      <div className="brand">
        <Sprout /> EggPro
      </div>
      <h1>
        A better day
        <br />
        on your farm.
      </h1>
      <p className="lead">
        Your cages, collections, and cash flow.
        <br />
        {cloud
          ? "Saved to your account. Available on your phones."
          : "All in one place. Always offline."}
      </p>
      {actions}
      <Card>
        <h2>Let’s set up your farm</h2>
        <p>You can adjust your cages and prices later.</p>
        <Form
          label="Create my farm"
          onSave={async (d) => {
            await farm.setup({
              name: str(d, "name"),
              owner: str(d, "owner"),
              cages: num(d, "cages"),
              hens: num(d, "hens"),
              currency: str(d, "currency") as "PHP",
              prices: Object.fromEntries(sizes.map((s) => [s, num(d, s)])),
              sackWeight: num(d, "sackWeight"),
              cost: num(d, "cost"),
            });
            await done();
          }}
        >
          <Field label="Farm name">
            <input
              name="name"
              placeholder="e.g. Sunrise Poultry Farm"
              required
              maxLength={200}
            />
          </Field>
          <Field label="Owner name · optional">
            <input name="owner" maxLength={200} />
          </Field>
          <div className="grid2">
            <NumberField
              label="Number of cages"
              name="cages"
              value={50}
              min={1}
            />
            <NumberField label="Hens per cage" name="hens" value={4} min={1} />
          </div>
          <Field label="Currency">
            <select name="currency">
              {["PHP", "USD", "EUR", "GBP", "AUD"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <h3>Default price per tray · 30 eggs</h3>
          <div className="grid2">
            {sizes.map((s, i) => (
              <NumberField
                key={s}
                label={s}
                name={s}
                value={[205, 225, 245, 255][i]}
                step="0.01"
              />
            ))}
          </div>
          <h3>Feed defaults</h3>
          <div className="grid2">
            <NumberField
              label="Sack weight (kg)"
              name="sackWeight"
              value={50}
              min={0.01}
              step="0.01"
            />
            <NumberField
              label="Cost per sack"
              name="cost"
              value={1530}
              step="0.01"
            />
          </div>
          <p className="hint">
            You’ll start with empty stock. Record your first feed purchase and
            egg collection to add inventory.
          </p>
        </Form>
      </Card>
      <p className="privacy">
        <ShieldCheck size={17} />{" "}
        {cloud
          ? "Saved to your account. Sign in on another phone to open your farm."
          : "Stored on this device. No account needed."}
      </p>
    </main>
  );
}
