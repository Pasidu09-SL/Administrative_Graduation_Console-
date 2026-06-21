import { PoolClient } from "pg";
import { createClient } from "@supabase/supabase-js";

/**
 * Generates a self-contained plain-text PostgreSQL logical dump targeting only the public schema.
 */
export async function generateLogicalDump(client: PoolClient): Promise<string> {
  let sql = "";
  sql += `-- Administrative Graduation Platform Database Backup\n`;
  sql += `-- Generated on: ${new Date().toISOString()}\n\n`;

  // Standard logical dump configuration
  sql += `SET statement_timeout = 0;\n`;
  sql += `SET lock_timeout = 0;\n`;
  sql += `SET idle_in_transaction_session_timeout = 0;\n`;
  sql += `SET client_encoding = 'UTF8';\n`;
  sql += `SET standard_conforming_strings = on;\n`;
  sql += `SET check_function_bodies = false;\n`;
  sql += `SET xmloption = content;\n`;
  sql += `SET client_min_messages = warning;\n`;
  sql += `SET row_security = off;\n\n`;

  // 1. Get all tables in the public schema
  const tablesRes = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE' 
    ORDER BY table_name;
  `);

  const tables = tablesRes.rows.map((r) => r.table_name);
  const foreignKeys: string[] = [];

  // 2. Generate table DDL, indexes, and RLS structures
  for (const tableName of tables) {
    // Fetch column details
    const colsRes = await client.query(
      `
      SELECT 
          a.attname AS column_name,
          pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
          (SELECT substring(pg_catalog.pg_get_expr(d.adbin, d.adrelid) for 128)
           FROM pg_catalog.pg_attrdef d
           WHERE d.adrelid = a.attrelid AND d.adnum = a.attnum AND a.atthasdef) AS column_default,
          a.attnotnull AS not_null
      FROM 
          pg_catalog.pg_attribute a
      WHERE 
          a.attrelid = $1::regclass
          AND a.attnum > 0 
          AND NOT a.attisdropped
      ORDER BY 
          a.attnum;
    `,
      [tableName],
    );

    const columnDefs: string[] = [];
    const sequenceStatements: string[] = [];
    const alterSequenceStatements: string[] = [];

    for (const col of colsRes.rows) {
      let colDef = `  "${col.column_name}" ${col.data_type}`;
      if (col.column_default !== null) {
        colDef += ` DEFAULT ${col.column_default}`;

        // Check for sequence defaults (e.g. nextval('seq'::regclass))
        if (col.column_default.includes("nextval(")) {
          const match = col.column_default.match(/nextval\('([^']+)'/);
          if (match && match[1]) {
            const seqName = match[1];
            const formattedSeq = seqName
              .split(".")
              .map((p: string) => `"${p}"`)
              .join(".");
            sequenceStatements.push(
              `CREATE SEQUENCE IF NOT EXISTS ${formattedSeq};\n`,
            );
            alterSequenceStatements.push(
              `ALTER SEQUENCE ${formattedSeq} OWNED BY "${tableName}"."${col.column_name}";\n`,
            );
          }
        }
      }
      if (col.not_null) {
        colDef += ` NOT NULL`;
      }
      columnDefs.push(colDef);
    }

    // Fetch constraints (Primary Key, Unique, Check) - excluding foreign keys
    const constsRes = await client.query(
      `
      SELECT
          conname AS constraint_name,
          pg_get_constraintdef(c.oid) AS constraint_def
      FROM
          pg_catalog.pg_constraint c
      WHERE
          c.conrelid = $1::regclass
          AND c.contype IN ('p', 'u', 'c');
    `,
      [tableName],
    );

    for (const con of constsRes.rows) {
      columnDefs.push(
        `  CONSTRAINT "${con.constraint_name}" ${con.constraint_def}`,
      );
    }

    sql += `-- Table: ${tableName}\n`;
    sql += `DROP TABLE IF EXISTS "${tableName}" CASCADE;\n\n`;

    // Prepend sequence creation statements
    for (const seqSql of sequenceStatements) {
      sql += seqSql;
    }
    if (sequenceStatements.length > 0) sql += "\n";

    sql += `CREATE TABLE "${tableName}" (\n`;
    sql += columnDefs.join(",\n") + "\n);\n\n";

    // Append sequence ownership alterations
    for (const alterSql of alterSequenceStatements) {
      sql += alterSql;
    }
    if (alterSequenceStatements.length > 0) sql += "\n";

    // Accumulate Foreign Key constraints to append at the very end
    const fkeysRes = await client.query(
      `
      SELECT
          conname AS constraint_name,
          pg_get_constraintdef(c.oid) AS constraint_def
      FROM
          pg_catalog.pg_constraint c
      WHERE
          c.conrelid = $1::regclass
          AND c.contype = 'f';
    `,
      [tableName],
    );

    for (const fkey of fkeysRes.rows) {
      foreignKeys.push(
        `ALTER TABLE "${tableName}" ADD CONSTRAINT "${fkey.constraint_name}" ${fkey.constraint_def};`,
      );
    }

    // Fetch and generate Indexes (excluding those implicitly created by UNIQUE or PRIMARY KEY constraints)
    const idxRes = await client.query(
      `
      SELECT
          pg_get_indexdef(i.indexrelid) AS index_def
      FROM
          pg_catalog.pg_index i
      WHERE
          i.indrelid = $1::regclass
          AND NOT i.indisprimary
          AND NOT EXISTS (
              SELECT 1 
              FROM pg_catalog.pg_constraint c 
              WHERE c.conindid = i.indexrelid
          );
    `,
      [tableName],
    );

    for (const idx of idxRes.rows) {
      sql += `${idx.index_def};\n`;
    }
    if (idxRes.rows.length > 0) sql += "\n";

    // Row Level Security Status
    const rlsRes = await client.query(
      `
      SELECT relrowsecurity, relforcerowsecurity 
      FROM pg_class 
      WHERE oid = $1::regclass;
    `,
      [tableName],
    );

    if (rlsRes.rows.length > 0) {
      const { relrowsecurity, relforcerowsecurity } = rlsRes.rows[0];
      if (relrowsecurity) {
        sql += `ALTER TABLE "${tableName}" ENABLE ROW LEVEL SECURITY;\n`;
      }
      if (relforcerowsecurity) {
        sql += `ALTER TABLE "${tableName}" FORCE ROW LEVEL SECURITY;\n`;
      }
    }

    // Fetch and generate RLS Policies
    const polRes = await client.query(
      `
      SELECT 
          policyname, 
          permissive, 
          roles, 
          cmd, 
          qual, 
          with_check 
      FROM pg_policies 
      WHERE schemaname = 'public' AND tablename = $1;
    `,
      [tableName],
    );

    for (const pol of polRes.rows) {
      let polDef = `CREATE POLICY "${pol.policyname}" ON "${tableName}"`;
      if (pol.permissive === "RESTRICTIVE") {
        polDef += " AS RESTRICTIVE";
      }
      if (pol.cmd && pol.cmd !== "ALL") {
        polDef += ` FOR ${pol.cmd}`;
      }
      
      const rolesStr = typeof pol.roles === "string"
        ? pol.roles.replace(/^\{|\}$/g, "")
        : Array.isArray(pol.roles)
          ? pol.roles.join(", ")
          : "";
          
      if (rolesStr) {
        polDef += ` TO ${rolesStr}`;
      }
      
      if (pol.qual) {
        polDef += ` USING (${pol.qual})`;
      }
      if (pol.with_check) {
        polDef += ` WITH CHECK (${pol.with_check})`;
      }
      sql += `${polDef};\n`;
    }
    if (polRes.rows.length > 0) sql += "\n";
  }

  // 3. Generate Insert Data and reset sequence levels
  for (const tableName of tables) {
    const colsRes = await client.query(
      `
      SELECT attname AS column_name
      FROM pg_catalog.pg_attribute
      WHERE attrelid = $1::regclass
        AND attnum > 0 
        AND NOT attisdropped
      ORDER BY attnum;
    `,
      [tableName],
    );
    const columns = colsRes.rows.map((c) => c.column_name);

    const rowsRes = await client.query(`SELECT * FROM "${tableName}"`);
    if (rowsRes.rows.length > 0) {
      sql += `-- Data for ${tableName}\n`;
      for (const row of rowsRes.rows) {
        const valuesSql = columns.map((colName) => {
          const val = row[colName];
          if (val === null) return "NULL";
          if (val instanceof Date) return `'${val.toISOString()}'`;
          if (typeof val === "object")
            return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
          if (typeof val === "string") return `'${val.replace(/'/g, "''")}'`;
          if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
          return val;
        });
        sql += `INSERT INTO "${tableName}" (${columns.map((c) => `"${c}"`).join(", ")}) VALUES (${valuesSql.join(", ")});\n`;
      }
      sql += "\n";
    }

    // Add sequence resets
    for (const col of colsRes.rows) {
      const seqRes = await client.query(
        `
        SELECT pg_get_serial_sequence($1, $2) AS seq_name;
      `,
        [tableName, col.column_name],
      );
      const seqName = seqRes.rows[0]?.seq_name;
      if (seqName) {
        sql += `SELECT setval('${seqName}', COALESCE((SELECT MAX("${col.column_name}") FROM "${tableName}"), 1), COALESCE((SELECT MAX("${col.column_name}") FROM "${tableName}") IS NOT NULL, false));\n`;
      }
    }
  }

  // 4. Append Foreign Key constraints
  if (foreignKeys.length > 0) {
    sql += `-- Foreign Key Constraints\n`;
    for (const fkey of foreignKeys) {
      sql += `${fkey}\n`;
    }
    sql += "\n";
  }

  // 5. Role and Permissions Setup
  sql += `-- Role and Permissions Setup\n`;
  sql += `DO $$\n`;
  sql += `BEGIN\n`;
  sql += `  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_user') THEN\n`;
  sql += `    CREATE ROLE app_user;\n`;
  sql += `  END IF;\n`;
  sql += `END\n`;
  sql += `$$;\n`;
  sql += `GRANT app_user TO postgres;\n`;
  sql += `GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_user;\n`;
  sql += `GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_user;\n`;

  return sql;
}

/**
 * Initializes and returns a privileged Supabase client.
 */
export function getSupabaseServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Supabase configurations missing. Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.",
    );
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Ensures that the given storage bucket exists in Supabase, creating it if necessary.
 */
export async function ensureBucketExists(supabase: any, bucketName: string) {
  const { data, error } = await supabase.storage.getBucket(bucketName);
  if (error || !data) {
    console.log(`Bucket ${bucketName} not found, attempting to create it...`);
    const { error: createError } = await supabase.storage.createBucket(
      bucketName,
      {
        public: true,
        allowedMimeTypes:
          bucketName === "student-photos"
            ? ["image/png", "image/jpeg", "image/jpg"]
            : ["image/png", "image/jpeg", "image/jpg", "application/pdf"],
        fileSizeLimit: 2 * 1024 * 1024, // 2MB
      },
    );
    if (createError) {
      console.error(
        `Failed to create bucket ${bucketName} with options:`,
        createError.message,
      );
      // Fallback
      await supabase.storage.createBucket(bucketName, { public: true });
    }
  }
}

/**
 * Recursively downloads all files from a Supabase Storage bucket.
 */
export async function downloadBucketContents(
  supabase: any,
  bucketName: string,
): Promise<{ name: string; buffer: Buffer }[]> {
  const filesList: { name: string; buffer: Buffer }[] = [];

  await ensureBucketExists(supabase, bucketName);

  async function listAndDownload(folderPath: string = "") {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .list(folderPath, {
        limit: 100,
        offset: 0,
      });

    if (error) {
      console.error(
        `Error listing bucket ${bucketName} folder ${folderPath}:`,
        error,
      );
      return;
    }
    if (!data) return;

    for (const item of data) {
      const itemPath = folderPath ? `${folderPath}/${item.name}` : item.name;
      // If it's a folder, id is null or metadata is null
      if (!item.id || item.metadata === null) {
        await listAndDownload(itemPath);
      } else {
        const { data: fileData, error: downloadError } = await supabase.storage
          .from(bucketName)
          .download(itemPath);

        if (downloadError) {
          console.error(
            `Error downloading file ${itemPath} from bucket ${bucketName}:`,
            downloadError,
          );
          continue;
        }
        if (fileData) {
          const arrayBuffer = await fileData.arrayBuffer();
          filesList.push({
            name: itemPath,
            buffer: Buffer.from(arrayBuffer),
          });
        }
      }
    }
  }

  await listAndDownload();
  return filesList;
}

/**
 * Uploads files to a Supabase Storage bucket, overwriting matches.
 */
export async function uploadBucketContents(
  supabase: any,
  bucketName: string,
  files: { name: string; buffer: Buffer }[],
): Promise<void> {
  await ensureBucketExists(supabase, bucketName);

  for (const file of files) {
    const { error } = await supabase.storage
      .from(bucketName)
      .upload(file.name, file.buffer, {
        upsert: true,
        contentType: getContentType(file.name),
      });

    if (error) {
      console.error(
        `Failed to upload ${file.name} to bucket ${bucketName}:`,
        error.message,
      );
      throw new Error(
        `Failed to upload ${file.name} to bucket ${bucketName}: ${error.message}`,
      );
    }
  }
}

function getContentType(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop();
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}
