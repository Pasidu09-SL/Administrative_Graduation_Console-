import { NextResponse } from "next/server";
import { runAsAdmin } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const data = await runAsAdmin(async (client) => {
      const res = await client.query(
        "SELECT convocation_year, is_active FROM registration_windows ORDER BY convocation_year DESC",
      );
      return res.rows;
    });

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized." },
        { status: 401 },
      );
    }

    const { convocation_year } = await req.json();

    if (!convocation_year) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required parameter: convocation_year.",
        },
        { status: 400 },
      );
    }

    const yearStr = convocation_year.trim();
    if (!yearStr) {
      return NextResponse.json(
        { success: false, error: "Convocation year cannot be empty." },
        { status: 400 },
      );
    }

    const data = await runAsAdmin(async (client) => {
      // 1. Deactivate current active session
      await client.query(
        "UPDATE registration_windows SET is_active = FALSE WHERE is_active = TRUE",
      );

      // 2. Check if the year already exists
      const existingRes = await client.query(
        "SELECT 1 FROM registration_windows WHERE convocation_year = $1",
        [yearStr],
      );

      let res;
      if (existingRes.rows.length > 0) {
        // Just set it as active, do NOT touch is_manually_closed status
        res = await client.query(
          `UPDATE registration_windows 
           SET is_active = TRUE 
           WHERE convocation_year = $1 
           RETURNING *`,
          [yearStr],
        );
      } else {
        // Create new one with epoch date timeline (1970-01-01) so it stays closed by default
        const epoch = new Date(0);
        res = await client.query(
          `INSERT INTO registration_windows (convocation_year, open_date, close_date, is_manually_closed, is_active)
           VALUES ($1, $2, $3, FALSE, TRUE)
           RETURNING *`,
          [yearStr, epoch, epoch],
        );
      }

      const newWindow = res.rows[0];

      // 3. Log the system session activation in the audit logs
      await client.query(
        `INSERT INTO audit_logs (admin_id, action_taken, student_id)
         VALUES ($1, $2, NULL)`,
        [
          session.username,
          `Activated new convocation session year '${yearStr}'`,
        ],
      );

      return newWindow;
    });

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
