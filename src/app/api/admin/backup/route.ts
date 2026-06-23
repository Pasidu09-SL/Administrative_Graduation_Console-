import { NextResponse } from "next/server";
import { runAsAdmin } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import {
  generateLogicalDump,
  getSupabaseServiceClient,
  downloadBucketContents,
} from "@/lib/backup-restore";
import AdmZip from "adm-zip";

export async function GET() {
  try {
    // 1. Verify administrator authentication
    const session = await getAdminSession();
    if (!session || session.role !== "Administrator") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    // 2. Perform Database Logical Dump (only public schema)
    const sqlDump = await runAsAdmin(async (client) => {
      const dump = await generateLogicalDump(client);
      await client.query(
        `INSERT INTO audit_logs (admin_id, action_taken)
         VALUES ($1, $2)`,
        [session.username, 'Downloaded full system backup (database SQL dump and storage assets)']
      );
      return dump;
    });

    // 3. Download physical assets from Supabase storage buckets
    let studentPhotos: { name: string; buffer: Buffer }[] = [];
    let paymentSlips: { name: string; buffer: Buffer }[] = [];

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceRoleKey) {
      try {
        const supabase = getSupabaseServiceClient();
        studentPhotos = await downloadBucketContents(supabase, "student-photos");
        paymentSlips = await downloadBucketContents(supabase, "payment-slips");
      } catch (storageErr: any) {
        console.error("Storage download failed, proceeding with empty directories in backup. Log:", storageErr.message);
      }
    } else {
      console.warn("SUPABASE_SERVICE_ROLE_KEY not configured. Skipping storage media download.");
    }

    // 4. Bundle components into ZIP archive
    const zip = new AdmZip();
    zip.addFile("public_schema.sql", Buffer.from(sqlDump, "utf8"));

    // Add media folders
    for (const photo of studentPhotos) {
      zip.addFile(`student-photos/${photo.name}`, photo.buffer);
    }
    for (const slip of paymentSlips) {
      zip.addFile(`payment-slips/${slip.name}`, slip.buffer);
    }

    const zipBuffer = zip.toBuffer();

    // 5. Generate filename and trigger download
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const filename = `RUSL_Graduation_Backup_${timestamp}.zip`;

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    console.error("Backup operation failed explicitly:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to generate backup." },
      { status: 500 },
    );
  }
}
