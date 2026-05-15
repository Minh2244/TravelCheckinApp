import type { RowDataPacket } from "mysql2/promise";

import { pool } from "../config/database";

type Args = {
  dryRun: boolean;
  autoMigrate: boolean;
  locationId: number | null;
  fromDate: string | null; // YYYY-MM-DD
  toDate: string | null; // YYYY-MM-DD (inclusive)
  windowSec: number;
  limitPreview: number;
};

const parseArgs = (): Args => {
  const raw = process.argv.slice(2);

  const read = (key: string): string | null => {
    const direct = raw.find((x) => x === `--${key}`);
    if (direct) {
      const idx = raw.indexOf(direct);
      const v = raw[idx + 1];
      return v ? String(v) : "";
    }

    const withEq = raw.find((x) => x.startsWith(`--${key}=`));
    if (withEq) return String(withEq.split("=").slice(1).join("="));

    return null;
  };

  const hasFlag = (key: string): boolean => {
    return raw.includes(`--${key}`);
  };

  const dryRunRaw = read("dry-run") ?? read("dryRun");
  const dryRun =
    hasFlag("dry-run") ||
    hasFlag("dryRun") ||
    dryRunRaw === "1" ||
    String(dryRunRaw || "").toLowerCase() === "true";

  const autoMigrateRaw = read("auto-migrate") ?? read("autoMigrate");
  const autoMigrate =
    hasFlag("auto-migrate") ||
    hasFlag("autoMigrate") ||
    autoMigrateRaw === "1" ||
    String(autoMigrateRaw || "").toLowerCase() === "true";

  const locationIdRaw = read("location_id") ?? read("locationId");
  const locationId = locationIdRaw ? Number(locationIdRaw) : null;

  const fromDate = (read("from") ?? read("fromDate"))?.trim() || null;
  const toDate = (read("to") ?? read("toDate"))?.trim() || null;

  const windowSecRaw = read("windowSec") ?? read("window_sec");
  const windowSec = windowSecRaw ? Number(windowSecRaw) : 30;

  const limitPreviewRaw = read("limit") ?? read("limitPreview");
  const limitPreview = limitPreviewRaw ? Number(limitPreviewRaw) : 20;

  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (fromDate && !dateRe.test(fromDate)) {
    throw new Error("Invalid --from. Expected YYYY-MM-DD");
  }
  if (toDate && !dateRe.test(toDate)) {
    throw new Error("Invalid --to. Expected YYYY-MM-DD");
  }
  if (locationIdRaw && !Number.isFinite(locationId)) {
    throw new Error("Invalid --location_id");
  }
  if (!Number.isFinite(windowSec) || windowSec < 1 || windowSec > 600) {
    throw new Error("Invalid --windowSec (1..600)");
  }
  if (
    !Number.isFinite(limitPreview) ||
    limitPreview < 0 ||
    limitPreview > 200
  ) {
    throw new Error("Invalid --limit (0..200)");
  }

  return {
    dryRun,
    autoMigrate,
    locationId: locationIdRaw ? locationId : null,
    fromDate,
    toDate,
    windowSec,
    limitPreview,
  };
};

const buildSellerSubquery = (windowSec: number) => {
  // Best-effort mapping:
  // - Match location_id from audit_logs.details
  // - If action=SELL_POS_TICKETS: match service_id
  // - If action=SELL_POS_TICKETS_BATCH: match presence of {service_id:<pt.service_id>} in $.items
  // - Choose nearest audit created_at vs pt.sold_at (within windowSec)
  return `(
    SELECT al.user_id
    FROM audit_logs al
    WHERE al.user_id IS NOT NULL
      AND al.action IN ('SELL_POS_TICKETS', 'SELL_POS_TICKETS_BATCH')
      AND CAST(JSON_UNQUOTE(JSON_EXTRACT(al.details, '$.location_id')) AS UNSIGNED) = pt.location_id
      AND ABS(TIMESTAMPDIFF(SECOND, al.created_at, pt.sold_at)) <= ${Number(windowSec)}
      AND (
        (al.action = 'SELL_POS_TICKETS'
          AND CAST(JSON_UNQUOTE(JSON_EXTRACT(al.details, '$.service_id')) AS UNSIGNED) = pt.service_id)
        OR
        (al.action = 'SELL_POS_TICKETS_BATCH'
          AND JSON_CONTAINS(al.details, JSON_OBJECT('service_id', pt.service_id), '$.items'))
      )
    ORDER BY ABS(TIMESTAMPDIFF(SECOND, al.created_at, pt.sold_at)) ASC
    LIMIT 1
  )`;
};

const buildWhere = (args: Args) => {
  const clauses: string[] = [
    "pt.sold_by IS NULL",
    "pt.sold_at IS NOT NULL",
    "pt.status <> 'void'",
  ];
  const params: any[] = [];

  if (args.locationId != null) {
    clauses.push("pt.location_id = ?");
    params.push(args.locationId);
  }

  if (args.fromDate) {
    clauses.push("DATE(pt.sold_at) >= ?");
    params.push(args.fromDate);
  }

  if (args.toDate) {
    clauses.push("DATE(pt.sold_at) <= ?");
    params.push(args.toDate);
  }

  return { whereSql: clauses.length ? clauses.join(" AND ") : "1=1", params };
};

const main = async () => {
  const args = parseArgs();

  const [colRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'pos_tickets'
       AND COLUMN_NAME = 'sold_by'`,
  );
  const hasSoldBy = Number(colRows?.[0]?.cnt || 0) > 0;
  if (!hasSoldBy) {
    if (!args.autoMigrate) {
      throw new Error(
        "pos_tickets.sold_by column not found. Re-run with --auto-migrate to add the column automatically, or run ALTER TABLE manually.",
      );
    }

    console.log(
      "pos_tickets.sold_by missing. Applying minimal migration (ADD COLUMN + ADD INDEX)...",
    );

    // Minimal migration: column + index. (FK is optional and can be added separately.)
    await pool.query(
      "ALTER TABLE pos_tickets ADD COLUMN sold_by INT NULL AFTER status",
    );
    await pool.query(
      "ALTER TABLE pos_tickets ADD INDEX pos_tickets_fk_sold_by (sold_by)",
    );
  }

  const sellerSubquery = buildSellerSubquery(args.windowSec);
  const { whereSql, params } = buildWhere(args);

  const countSql = `
    SELECT COUNT(*) AS to_fill
    FROM pos_tickets pt
    WHERE ${whereSql}
      AND ${sellerSubquery} IS NOT NULL
  `;

  const [countRows] = await pool.query<RowDataPacket[]>(countSql, params);
  const toFill = Number(countRows?.[0]?.to_fill || 0);

  console.log(
    JSON.stringify(
      {
        ok: true,
        dry_run: args.dryRun,
        location_id: args.locationId,
        from: args.fromDate,
        to: args.toDate,
        window_sec: args.windowSec,
        can_fill: toFill,
      },
      null,
      2,
    ),
  );

  if (args.limitPreview > 0) {
    const previewSql = `
      SELECT
        pt.pos_ticket_id,
        pt.location_id,
        pt.service_id,
        pt.ticket_code,
        pt.sold_at,
        ${sellerSubquery} AS inferred_sold_by,
        u.full_name AS inferred_seller_name
      FROM pos_tickets pt
      LEFT JOIN users u ON u.user_id = (${sellerSubquery})
      WHERE ${whereSql}
        AND ${sellerSubquery} IS NOT NULL
      ORDER BY pt.sold_at ASC
      LIMIT ${Number(args.limitPreview)}
    `;

    const [previewRows] = await pool.query<RowDataPacket[]>(previewSql, params);
    console.log(JSON.stringify({ preview: previewRows }, null, 2));
  }

  if (args.dryRun) {
    console.log(
      "Dry-run only: no UPDATE executed. Re-run without --dry-run to apply changes.",
    );
    return;
  }

  const updateSql = `
    UPDATE pos_tickets pt
    SET pt.sold_by = ${sellerSubquery}
    WHERE ${whereSql}
      AND ${sellerSubquery} IS NOT NULL
  `;

  const [result]: any = await pool.query(updateSql, params);
  console.log(
    JSON.stringify(
      {
        updated_rows: Number(result?.affectedRows || 0),
      },
      null,
      2,
    ),
  );
};

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    try {
      await pool.end();
    } catch {
      // ignore
    }
  });
