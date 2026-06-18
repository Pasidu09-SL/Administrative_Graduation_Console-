import { NextResponse } from "next/server";
import { runAsAdmin } from "@/lib/db";
import { getAdminSession, signMagicToken } from "@/lib/auth";
import { sendEmail, getMagicLinkTemplate } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { studentIds, type = 'onboarding' } = await req.json();
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "No student IDs provided." },
        { status: 400 },
      );
    }

    const { origin } = new URL(req.url);
    const results = await runAsAdmin(async (client) => {
      // 1. Fetch the custom email template from DB
      const tempRes = await client.query(
        "SELECT subject, body FROM email_templates WHERE template_key = $1",
        [type === 'confirmation' ? 'confirmation' : (type === 'in_absentia' ? 'in_absentia' : 'magic_link')],
      );
      const customTemplate = tempRes.rows[0];

      // 2. Fetch targeted students
      const studRes = await client.query(
        "SELECT id, email, index_no, registration_no, convocation_year, name_with_initials, session_number, seat_number, certificate_number FROM students WHERE id = ANY($1)",
        [studentIds],
      );
      const students = studRes.rows;

      // 3. Fetch convocation sessions for building the table (if type is onboarding/magic_link)
      let sessionDetailsTableHtml = "";
      let portalValidityDays = "7"; // default fallback
      if (type === 'onboarding' || type === 'magic_link') {
        // Fetch portal open/close window to compute validity days
        const windowRes = await client.query(
          "SELECT open_date, close_date FROM registration_windows WHERE is_active = TRUE LIMIT 1"
        );
        if (windowRes.rows.length > 0) {
          const { open_date, close_date } = windowRes.rows[0];
          if (open_date && close_date) {
            const openMs = new Date(open_date).getTime();
            const closeMs = new Date(close_date).getTime();
            const diffDays = Math.max(1, Math.round((closeMs - openMs) / (1000 * 60 * 60 * 24)));
            portalValidityDays = String(diffDays);
          }
        }

        const sessionsRes = await client.query('SELECT * FROM convocation_sessions ORDER BY session_number ASC');
        const sessions = sessionsRes.rows;

        const tableRows: string[] = [];
        for (const sess of sessions) {
          // Format date as "25th May 2026"
          let dateStr = "TBD";
          if (sess.session_date) {
            const d = new Date(sess.session_date);
            const day = d.getUTCDate();
            const ordinal = (n: number) => {
              if (n >= 11 && n <= 13) return n + "th";
              switch (n % 10) { case 1: return n + "st"; case 2: return n + "nd"; case 3: return n + "rd"; default: return n + "th"; }
            };
            const monthName = d.toLocaleString("en-GB", { month: "long", timeZone: "UTC" });
            const year = d.getUTCFullYear();
            dateStr = `${ordinal(day)} ${monthName} ${year}`;
          }
          // Format time as "09.00 a.m." / "02.30 p.m."
          let timeStr = "TBD";
          if (sess.session_time) {
            const [hStr, mStr] = sess.session_time.split(":");
            let h = parseInt(hStr, 10);
            const m = mStr ? mStr.substring(0, 2) : "00";
            const period = h >= 12 ? "p.m." : "a.m.";
            h = h % 12 || 12;
            timeStr = `${String(h).padStart(2, "0")}.${m} ${period}`;
          }

          if (sess.faculty_1) {
            tableRows.push(`
              <tr>
                <td style="border: 1px solid #ddd; padding: 8px;">Session ${sess.session_number}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${sess.faculty_1}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${dateStr}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${timeStr}</td>
              </tr>
            `);
          }
          if (sess.faculty_2) {
            tableRows.push(`
              <tr>
                <td style="border: 1px solid #ddd; padding: 8px;">Session ${sess.session_number}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${sess.faculty_2}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${dateStr}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${timeStr}</td>
              </tr>
            `);
          }
        }

        sessionDetailsTableHtml = `
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px; font-family: sans-serif; font-size: 13px;">
            <thead>
              <tr style="background-color: #f2f2f2; text-align: left;">
                <th style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Session</th>
                <th style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Faculty/Group</th>
                <th style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Date</th>
                <th style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Time</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows.length > 0 ? tableRows.join('') : '<tr><td colspan="4" style="border: 1px solid #ddd; padding: 8px; text-align: center; color: #888;">No sessions scheduled yet.</td></tr>'}
            </tbody>
          </table>
        `;
      }

      if (type === 'confirmation') {
        const unallocated = students.filter(s => s.session_number === null);
        if (unallocated.length > 0) {
          throw new Error("Cannot send confirmation emails. Some selected students do not have seating allocated.");
        }
      } else if (type === 'in_absentia') {
        const unallocated = students.filter(s => s.certificate_number === null);
        if (unallocated.length > 0) {
          throw new Error("Cannot send in absentia confirmation emails. Some selected students do not have certificate numbers allocated.");
        }
      }

      let successCount = 0;
      const failedEmails: string[] = [];

      for (const student of students) {
        let subject = "";
        let htmlContent = "";
        let magicToken = "";

        if (type === 'confirmation') {
          subject = "Graduation Registration Confirmed - Seating Allocation";
          if (customTemplate) {
            subject = customTemplate.subject;
            htmlContent = customTemplate.body
              .replace(/\{\{student_name\}\}/g, student.name_with_initials)
              .replace(/\{\{session_number\}\}/g, String(student.session_number))
              .replace(/\{\{seat_number\}\}/g, String(student.seat_number))
              .replace(/\{\{certificate_number\}\}/g, student.certificate_number || '');
          } else {
            const { getConfirmationTemplate } = await import("@/lib/email");
            htmlContent = await getConfirmationTemplate(
              student.name_with_initials,
              student.session_number,
              student.seat_number,
              student.certificate_number || ''
            );
          }
        } else if (type === 'in_absentia') {
          subject = "Graduation Registration Confirmed - In Absentia";
          if (customTemplate) {
            subject = customTemplate.subject;
            htmlContent = customTemplate.body
              .replace(/\{\{student_name\}\}/g, student.name_with_initials)
              .replace(/\{\{certificate_number\}\}/g, student.certificate_number || '');
          } else {
            htmlContent = `
              <!DOCTYPE html>
              <html>
              <body>
                <h2>In Absentia Graduation Confirmed</h2>
                <p>Dear ${student.name_with_initials},</p>
                <p>Your graduation registration has been confirmed in absentia. Your certificate number is: <strong>${student.certificate_number || ''}</strong></p>
              </body>
              </html>
            `;
          }
        } else {
          // Generate magic token and link
          magicToken = signMagicToken(student.email, student.registration_no, student.convocation_year);
          const magicLink = `${origin}/api/student/auth/magic-login?email=${encodeURIComponent(student.email.toLowerCase().trim())}&token=${encodeURIComponent(magicToken)}`;

          subject = "Convocation Registration - Action Required";
          if (customTemplate) {
            subject = customTemplate.subject;
            htmlContent = customTemplate.body
              .replace(/\{\{student_name\}\}/g, student.name_with_initials)
              .replace(/\{\{magic_link_url\}\}/g, magicLink)
              .replace(/\{\{session_details_table\}\}/g, sessionDetailsTableHtml)
              .replace(/\{\{portal_validity_days\}\}/g, portalValidityDays);
          } else {
            htmlContent = await getMagicLinkTemplate(
              student.name_with_initials,
              magicLink,
              sessionDetailsTableHtml,
              portalValidityDays,
            );
          }
        }

        try {
          // Send email
          await sendEmail({
            to: [
              {
                email: student.email.toLowerCase().trim(),
                name: student.name_with_initials,
              },
            ],
            subject,
            htmlContent,
          });

          // Save status in DB
          if (type === 'confirmation' || type === 'in_absentia') {
            await client.query(
              "UPDATE students SET confirmation_email_sent = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
              [student.id],
            );
          } else {
            await client.query(
              "UPDATE students SET email_sent = TRUE, magic_token = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
              [magicToken, student.id],
            );
          }

          successCount++;
        } catch (err: any) {
          console.error(
            `Failed to dispatch manual email to ${student.email}:`,
            err.message,
          );
          failedEmails.push(student.email);
        }
      }

      // Log dispatch action in audit logs
      if (successCount > 0) {
        let actionText = "";
        if (type === 'confirmation') {
          actionText = `Dispatched seat confirmation email to ${successCount} candidates`;
        } else if (type === 'in_absentia') {
          actionText = `Dispatched in absentia confirmation email to ${successCount} candidates`;
        } else {
          actionText = `Dispatched onboarding magic link email to ${successCount} candidates`;
        }
        await client.query(
          `INSERT INTO audit_logs (admin_id, action_taken, student_id)
           VALUES ($1, $2, NULL)`,
          [
            session.username,
            actionText,
          ],
        );
      }

      return { successCount, failedEmails };
    });

    return NextResponse.json({
      success: true,
      sentCount: results.successCount,
      failedEmails: results.failedEmails,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 400 },
    );
  }
}
