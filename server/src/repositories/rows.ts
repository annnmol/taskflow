import { pool } from "../db.js";

export type FileRow = {
  id: string;
  row_number: number;
  data: Record<string, string>;
  created_at: Date | string;
};

export const listRows = async (fileId: string, page: number, pageSize: number) => {
  const offset = (page - 1) * pageSize;
  const [rowsResult, countResult] = await Promise.all([
    pool.query<FileRow>(
      `SELECT id, row_number, data, created_at
       FROM file_rows
       WHERE file_id = $1
       ORDER BY row_number
       LIMIT $2 OFFSET $3`,
      [fileId, pageSize, offset]
    ),
    pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM file_rows
       WHERE file_id = $1`,
      [fileId]
    )
  ]);

  return {
    rows: rowsResult.rows.map((row) => ({
      id: row.id,
      rowNumber: row.row_number,
      data: row.data,
      createdAt: new Date(row.created_at).toISOString()
    })),
    total: Number(countResult.rows[0]?.count || 0),
    page,
    pageSize
  };
};
