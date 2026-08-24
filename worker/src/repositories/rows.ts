import { randomUUID } from "node:crypto";
import { pool } from "../db.js";

export type CsvRow = Record<string, string>;

const batchSize = 100;

export const insertRows = async (fileId: string, rows: CsvRow[]): Promise<void> => {
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize);
    const values: unknown[] = [];
    const placeholders = batch.map((row, index) => {
      const valueOffset = index * 4;
      values.push(randomUUID(), fileId, offset + index + 1, JSON.stringify(row));
      return `($${valueOffset + 1}, $${valueOffset + 2}, $${valueOffset + 3}, $${valueOffset + 4})`;
    });

    await pool.query(
      `INSERT INTO file_rows (id, file_id, row_number, data)
       VALUES ${placeholders.join(", ")}
       ON CONFLICT (file_id, row_number)
       DO UPDATE SET data = EXCLUDED.data`,
      values
    );
  }
};
