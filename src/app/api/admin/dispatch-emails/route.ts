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
        [type === 'confirmation' ? 'confirmation' : 'magic_link'],
      );
      const customTemplate = tempRes.rows[0];

      // 2. Fetch targeted students
      const studRes = await client.query(
        "SELECT id, email, index_no, registration_no, convocation_year, name_with_initials, session_number, seat_number, certificate_number FROM students WHERE id = ANY($1)",
        [studentIds],
      );
      const students = studRes.rows;

      if (type === 'confirmation') {
        const unallocated = students.filter(s => s.session_number === null);
        if (unallocated.length > 0) {
          throw new Error("Cannot send confirmation emails. Some selected students do not have seating allocated.");
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
        } else {
          // Generate magic token and link
          magicToken = signMagicToken(student.email, student.registration_no, student.convocation_year);
          const magicLink = `${origin}/api/student/auth/magic-login?email=${encodeURIComponent(student.email.toLowerCase().trim())}&token=${encodeURIComponent(magicToken)}`;

          subject = "Convocation Registration - Action Required";
          if (customTemplate) {
            subject = customTemplate.subject;
            htmlContent = customTemplate.body
              .replace(/\{\{student_name\}\}/g, student.name_with_initials)
              .replace(/\{\{magic_link_url\}\}/g, magicLink);
          } else {
            htmlContent = await getMagicLinkTemplate(
              student.name_with_initials,
              magicLink,
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
          if (type === 'confirmation') {
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
        const actionText = type === 'confirmation'
          ? `Dispatched seat confirmation email to ${successCount} candidates`
          : `Dispatched onboarding magic link email to ${successCount} candidates`;
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
