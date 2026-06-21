import { NextResponse } from "next/server";
import { runAsAdmin } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import {
  getSupabaseServiceClient,
  uploadBucketContents,
} from "@/lib/backup-restore";
import AdmZip from "adm-zip";
import fs from "fs";
import path from "path";

// Helper to recursively list all files in a directory
function getFilesRecursively(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesRecursively(filePath));
    } else {
      results.push(filePath);
    }
  }
  return results;
}

export async function POST(req: Request) {
  const tempDir = path.join(process.cwd(), "scratch", `restore_${Date.now()}`);
  
  try {
    // 1. Verify administrator authentication
    const session = await getAdminSession();
    if (!session || session.role !== "Administrator") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    // 2. Read raw binary stream from uploader
    const buffer = Buffer.from(await req.arrayBuffer());
    if (buffer.length === 0) {
      return NextResponse.json(
        { success: false, error: "Empty restore archive uploaded." },
        { status: 400 },
      );
    }

    // 3. Step 1: Unpack Archive into temporary directory
    fs.mkdirSync(tempDir, { recursive: true });
    try {
      const zip = new AdmZip(buffer);
      zip.extractAllTo(tempDir, true);
    } catch (zipErr: any) {
      throw new Error(`Failed to extract zip archive: ${zipErr.message}`);
    }

    const sqlPath = path.join(tempDir, "public_schema.sql");
    if (!fs.existsSync(sqlPath)) {
      throw new Error("Invalid backup archive: public_schema.sql is missing.");
    }
    const sqlContent = fs.readFileSync(sqlPath, "utf8");

    // 4. Step 2: Database Reconstruction
    // Run the SQL script to drop tables and cleanly rebuild them
    await runAsAdmin(async (client) => {
      await client.query(sqlContent);
    });

    // 5. Step 3: Media Sync Restoration
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceRoleKey) {
      const supabase = getSupabaseServiceClient();

      // Restore student-photos bucket
      const photosDir = path.join(tempDir, "student-photos");
      if (fs.existsSync(photosDir)) {
        const photoFiles = getFilesRecursively(photosDir);
        const filesToUpload = photoFiles.map((file) => ({
          name: path.relative(photosDir, file).replace(/\\/g, "/"),
          buffer: fs.readFileSync(file),
        }));
        if (filesToUpload.length > 0) {
          await uploadBucketContents(supabase, "student-photos", filesToUpload);
        }
      }

      // Restore payment-slips bucket
      const slipsDir = path.join(tempDir, "payment-slips");
      if (fs.existsSync(slipsDir)) {
        const slipFiles = getFilesRecursively(slipsDir);
        const filesToUpload = slipFiles.map((file) => ({
          name: path.relative(slipsDir, file).replace(/\\/g, "/"),
          buffer: fs.readFileSync(file),
        }));
        if (filesToUpload.length > 0) {
          await uploadBucketContents(supabase, "payment-slips", filesToUpload);
        }
      }
    } else {
      console.warn(
        "SUPABASE_SERVICE_ROLE_KEY not configured. Skipping Media Sync Restoration.",
      );
    }

    // 6. Step 4: Workspace Cleanup
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    return NextResponse.json({
      success: true,
      message: "System successfully restored to backup state.",
    });
  } catch (err: any) {
    // Clean up temp workspace on failure
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (cleanupErr) {
      console.error("Failed to clean up temp directory on failure:", cleanupErr);
    }

    // Rollback is handled automatically by runAsAdmin transaction blocks
    // Log failure explicitly to administrative server terminal logs
    console.error("ADMIN RESTORATION FAILURE LOGGED TO SECURE TERMINAL:", err);

    return NextResponse.json(
      {
        success: false,
        error: `Restoration failed: ${err.message || err}`,
      },
      { status: 500 },
    );
  }
}
