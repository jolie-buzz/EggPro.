import type { SupabaseClient } from "@supabase/supabase-js";
import type { Backup } from "../services/backup";
export interface CloudRecord {
  revision: number;
  document: Backup;
  mutation_id: string;
  updated_at: string;
}
export interface CloudStore {
  read(): Promise<CloudRecord | null>;
  write(
    document: Backup,
    revision: number,
    mutationId: string,
  ): Promise<CloudRecord>;
}
export function accountStore(
  client: SupabaseClient,
  owner: string,
): CloudStore {
  return {
    async read() {
      const { data, error } = await client
        .from("eggpro_farms")
        .select("revision,document,mutation_id,updated_at")
        .eq("owner_id", owner)
        .maybeSingle();
      if (error)
        throw new Error(
          "Could not load your online farm. Check your connection and try again.",
        );
      return data as CloudRecord | null;
    },
    async write(document, revision, mutationId) {
      const { data, error } = await client.rpc("save_eggpro_farm", {
        expected_owner: owner,
        expected_revision: revision,
        new_document: document,
        request_id: mutationId,
      });
      if (error) {
        if (error.code === "40001")
          throw new Error(
            "Another phone has updated this farm. Reload the farm, check its latest records, then enter this change again. Nothing was overwritten.",
          );
        throw new Error(
          "Cloud save could not be confirmed. Reload the farm before retrying, so the same entry is not saved twice.",
        );
      }
      return { ...data, document } as CloudRecord;
    },
  };
}
