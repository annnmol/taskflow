import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';

export type FileRow = {
  id: string;
  row_number: number;
  data: Record<string, string>;
  created_at: Date | string;
};

export type FileRowsResult = {
  rows: {
    id: string;
    rowNumber: number;
    data: Record<string, string>;
    createdAt: string;
  }[];
  total: number;
  page: number;
  pageSize: number;
};

@Injectable()
export class RowsRepository {
  constructor(private readonly dbService: DbService) {}

  async listRows(
    fileId: string,
    page: number,
    pageSize: number,
  ): Promise<FileRowsResult> {
    const offset = (page - 1) * pageSize;

    const [rowsResult, countResult] = await Promise.all([
      this.dbService.query<FileRow>(
        `SELECT
             id,
             row_number,
             data,
             created_at
           FROM file_rows
           WHERE file_id = $1
           ORDER BY row_number
           LIMIT $2
           OFFSET $3`,
        [fileId, pageSize, offset],
      ),

      this.dbService.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
           FROM file_rows
           WHERE file_id = $1`,
        [fileId],
      ),
    ]);

    return {
      rows: rowsResult.rows.map((row) => ({
        id: row.id,
        rowNumber: row.row_number,
        data: row.data,
        createdAt: new Date(row.created_at).toISOString(),
      })),

      total: Number(countResult.rows[0]?.count ?? 0),

      page,
      pageSize,
    };
  }
}
