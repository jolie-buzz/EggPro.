import { migrations } from "./migrations";
export type Value = string | number | null;
export type Row = Record<string, Value>;
export interface Driver {
  query(sql: string, values?: Value[]): Promise<Row[]>;
  execute(sql: string, values?: Value[]): Promise<void>;
  persist(): Promise<void>;
}
export class Database {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(public driver: Driver) {}
  query<T = Row>(sql: string, values: Value[] = []): Promise<T[]> {
    return this.driver.query(sql, values) as Promise<T[]>;
  }
  execute(sql: string, values: Value[] = []) {
    return this.driver.execute(sql, values.length ? values : undefined);
  }
  // Serialize reads and writes at repository boundaries to avoid observing partial transactions.
  exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.tail.then(fn);
    this.tail = result.catch(() => undefined);
    return result;
  }
  transaction<T>(fn: () => Promise<T>): Promise<T> {
    return this.exclusive(async () => {
      await this.execute("BEGIN TRANSACTION");
      let committed = false;
      try {
        const result = await fn();
        await this.execute("COMMIT");
        committed = true;
        await this.driver.persist();
        return result;
      } catch (error) {
        if (!committed) await this.execute("ROLLBACK");
        throw error;
      }
    });
  }
  async migrate() {
    await this.execute("PRAGMA foreign_keys = ON");
    await this.execute(
      "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY)",
    );
    const applied = await this.query<{ version: number }>(
      "SELECT version FROM schema_migrations",
    );
    for (const migration of migrations)
      if (!applied.some((r) => r.version === migration.version)) {
        // SQLite requires foreign keys disabled outside the transaction when
        // rebuilding a referenced table. Validate references before committing.
        if (migration.rebuildsReferencedTables)
          await this.execute("PRAGMA foreign_keys = OFF");
        try {
          await this.transaction(async () => {
            await this.execute(migration.sql);
            if ((await this.query("PRAGMA foreign_key_check")).length)
              throw new Error("Migration would break record references");
            await this.execute(
              "INSERT INTO schema_migrations(version) VALUES (?)",
              [migration.version],
            );
          });
        } finally {
          await this.execute("PRAGMA foreign_keys = ON");
        }
      }
  }
}
