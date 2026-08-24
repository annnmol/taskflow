import { pool } from "../db.js";

export type WorkerFile = {
  id: string;
  stored_path: string | null;
};

export const findFile = async (id: string): Promise<WorkerFile | null> => {
  const result = await pool.query<WorkerFile>(
    `SELECT id, stored_path
     FROM files
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
};

export const updateFileStatus = async (
  id: string,
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED"
): Promise<void> => {
  await pool.query(
    `UPDATE files
     SET status = $2, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [id, status]
  );
};
