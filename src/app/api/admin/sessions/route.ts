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
      // Get the active convocation year
      const activeYearRes = await client.query(
        "SELECT convocation_year FROM registration_windows WHERE is_active = TRUE LIMIT 1",
      );
      const activeYear = activeYearRes.rows[0]?.convocation_year || "2026";

      // 1. Fetch sessions
      const sessionsRes = await client.query('SELECT * FROM convocation_sessions ORDER BY session_number ASC');
      const sessions = sessionsRes.rows;

      // 2. Fetch faculties
      const facultiesRes = await client.query('SELECT * FROM faculties ORDER BY name ASC');
      const faculties = facultiesRes.rows;

      // 3. Fetch degrees
      const degreesRes = await client.query('SELECT * FROM degrees ORDER BY name_en ASC');
      const degrees = degreesRes.rows;

      // 4. Fetch all approved students for this convocation year
      const studentsRes = await client.query(
        `SELECT s.id, s.faculty, s.attending_convocation, s.seat_number, s.session_number, s.degree_id, d.type as degree_type
         FROM students s
         LEFT JOIN degrees d ON s.degree_id = d.id
         WHERE s.verification_status = 'Approved' AND s.convocation_year = $1`,
        [activeYear]
      );
      const students = studentsRes.rows;

      // Build group definitions
      const groupNames = [
        ...faculties.map((f: any) => `${f.name} (Internal)`),
        "All External Degrees"
      ];

      const groupStats = groupNames.map((groupName) => {
        // Find mapped session
        const mappedSession = sessions.find(
          (s: any) => s.faculty_1 === groupName || s.faculty_2 === groupName
        );

        // Find degrees belonging to this group
        const groupDegrees = degrees.filter((d: any) => {
          if (groupName === "All External Degrees") {
            return d.type === "External";
          } else {
            const facultyName = groupName.replace(" (Internal)", "");
            return d.faculty === facultyName && d.type === "Internal";
          }
        });

        // Filter approved students in this group
        const groupStudents = students.filter((s: any) => {
          if (groupName === "All External Degrees") {
            return s.degree_type === "External";
          } else {
            const facultyName = groupName.replace(" (Internal)", "");
            return s.faculty === facultyName && s.degree_type === "Internal";
          }
        });

        // Attending students only
        const attendingStudents = groupStudents.filter((s: any) => s.attending_convocation === true);
        const allocatedAttending = attendingStudents.filter((s: any) => s.seat_number !== null && s.session_number !== null);

        // Attending students per degree
        const degreeStats = groupDegrees.map((deg: any) => {
          const count = attendingStudents.filter((s: any) => s.degree_id === deg.id).length;
          return {
            id: deg.id,
            name: deg.name_en,
            attendingCount: count
          };
        });

        const isSeatingAllocated = attendingStudents.length > 0 && attendingStudents.length === allocatedAttending.length;

        return {
          groupName,
          sessionNumber: mappedSession ? mappedSession.session_number : null,
          sessionName: mappedSession ? mappedSession.session_name : null,
          sessionDate: mappedSession ? mappedSession.session_date : null,
          sessionTime: mappedSession ? mappedSession.session_time : null,
          degreeCount: groupDegrees.length,
          totalAttendingCount: attendingStudents.length,
          degrees: degreeStats,
          isSeatingAllocated
        };
      });

      return groupStats;
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
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { faculty, group, sessionNumber } = await req.json();
    const targetGroup = group || faculty;

    if (!targetGroup) {
      return NextResponse.json(
        { success: false, error: "Group is required." },
        { status: 400 },
      );
    }

    let sessNum = sessionNumber !== undefined ? parseInt(sessionNumber) : undefined;

    const result = await runAsAdmin(async (client) => {
      // Get the active convocation year
      const activeYearRes = await client.query(
        "SELECT convocation_year FROM registration_windows WHERE is_active = TRUE LIMIT 1",
      );
      const activeYear = activeYearRes.rows[0]?.convocation_year || "2026";

      if (sessNum === undefined) {
        // Look up the mapped session for this group
        const sessionRes = await client.query(
          "SELECT session_number FROM convocation_sessions WHERE faculty_1 = $1 OR faculty_2 = $1 LIMIT 1",
          [targetGroup]
        );
        if (sessionRes.rows.length === 0) {
          throw new Error(`Group ${targetGroup} has not been allocated to any session in the Session Allocation tab yet.`);
        }
        sessNum = sessionRes.rows[0].session_number;
      }

      if (sessNum === undefined || sessNum === null) {
        throw new Error("Invalid session number.");
      }

      if (sessNum < 1) {
        throw new Error("Session number must be greater than 0.");
      }

      // 1. Verify session limit: max 2 groups per session
      const assignedRes = await client.query(
        `
        SELECT DISTINCT s.faculty, d.type as degree_type
        FROM students s
        LEFT JOIN degrees d ON s.degree_id = d.id
        WHERE s.session_number = $1 AND s.convocation_year = $2
      `,
        [sessNum, activeYear],
      );

      const activeGroups = new Set<string>();
      for (const row of assignedRes.rows) {
        if (row.degree_type === "External") {
          activeGroups.add("All External Degrees");
        } else {
          const facName = row.faculty;
          activeGroups.add(`${facName} (Internal)`);
        }
      }

      // If the targetGroup is already in the session, it is being reallocated, so remove it from current group count check
      activeGroups.delete(targetGroup);
      if (activeGroups.size >= 2) {
        throw new Error(
          `Session ${sessNum} is already full (occupied by: ${Array.from(activeGroups).join(", ")}).`,
        );
      }

      // 2. Reset seating details for this group (in case they are reassigned)
      if (
        targetGroup === "All External Degrees" ||
        targetGroup === "External"
      ) {
        await client.query(
          `
          UPDATE students s
          SET session_number = NULL, seat_number = NULL, certificate_number = NULL
          FROM degrees d
          WHERE s.degree_id = d.id AND d.type = 'External' AND s.convocation_year = $1
        `,
          [activeYear],
        );
      } else if (targetGroup.endsWith(" (Internal)")) {
        const actualFaculty = targetGroup.replace(" (Internal)", "");
        await client.query(
          `
          UPDATE students s
          SET session_number = NULL, seat_number = NULL, certificate_number = NULL
          FROM degrees d
          WHERE s.degree_id = d.id AND s.faculty = $1 AND (d.type = 'Internal' OR d.type IS NULL) AND s.convocation_year = $2
        `,
          [actualFaculty, activeYear],
        );
      } else {
        // Legacy fallback
        await client.query(
          `
          UPDATE students s
          SET session_number = NULL, seat_number = NULL, certificate_number = NULL
          WHERE s.faculty = $1 AND s.convocation_year = $2
        `,
          [targetGroup, activeYear],
        );
      }

      // 3. Query maximum existing seat number in this session
      const maxSeatRes = await client.query(
        "SELECT COALESCE(MAX(seat_number), 0) as max_seat FROM students WHERE session_number = $1 AND convocation_year = $2",
        [sessNum, activeYear],
      );
      let nextSeat = parseInt(maxSeatRes.rows[0].max_seat) + 1;

      // 4. Fetch students of this group
      let studentsRes;
      if (
        targetGroup === "All External Degrees" ||
        targetGroup === "External"
      ) {
        studentsRes = await client.query(
          `
          SELECT s.id, s.attending_convocation 
          FROM students s
          JOIN degrees d ON s.degree_id = d.id
          WHERE d.type = 'External' AND s.verification_status = 'Approved' AND s.convocation_year = $1
          ORDER BY d.degree_no ASC, s.import_order ASC
        `,
          [activeYear],
        );
      } else if (targetGroup.endsWith(" (Internal)")) {
        const actualFaculty = targetGroup.replace(" (Internal)", "");
        studentsRes = await client.query(
          `
          SELECT s.id, s.attending_convocation 
          FROM students s
          JOIN degrees d ON s.degree_id = d.id
          WHERE s.faculty = $1 AND (d.type = 'Internal' OR d.type IS NULL) AND s.verification_status = 'Approved' AND s.convocation_year = $2
          ORDER BY d.degree_no ASC, s.import_order ASC
        `,
          [actualFaculty, activeYear],
        );
      } else {
        // Legacy fallback
        studentsRes = await client.query(
          `
          SELECT s.id, s.attending_convocation 
          FROM students s
          LEFT JOIN degrees d ON s.degree_id = d.id
          WHERE s.faculty = $1 AND s.verification_status = 'Approved' AND s.convocation_year = $2
          ORDER BY d.degree_no ASC, s.import_order ASC
        `,
          [targetGroup, activeYear],
        );
      }
      const studentsList = studentsRes.rows;
      if (studentsList.length === 0) {
        throw new Error(
          `No approved candidates found for group: ${targetGroup}`,
        );
      }

      // 5. Query maximum existing 8-digit certificate number matching activeYear (e.g. '2026%')
      const maxCertRes = await client.query(
        `SELECT certificate_number 
         FROM students 
         WHERE convocation_year = $1 AND certificate_number LIKE $2
         ORDER BY certificate_number DESC LIMIT 1`,
        [activeYear, `${activeYear}%`]
      );
      
      let nextSeq = 1;
      const maxCertRow = maxCertRes.rows[0];
      if (maxCertRow && maxCertRow.certificate_number) {
        const lastCert = maxCertRow.certificate_number.trim();
        if (lastCert.length === 8 && lastCert.startsWith(activeYear)) {
          const seqStr = lastCert.substring(4);
          const parsedSeq = parseInt(seqStr, 10);
          if (!isNaN(parsedSeq)) {
            nextSeq = parsedSeq + 1;
          }
        }
      }

      // Helper function to pad sequence with zeros to 4 digits
      const padSeq = (seq: number) => String(seq).padStart(4, "0");

      // 6. Sequentially allocate seating and certificate numbers (using bulk UPDATE for performance)
      if (studentsList.length > 0) {
        const valuesArr: any[] = [];
        const valueStrings: string[] = [];
        let pIndex = 1;

        studentsList.forEach((student: any) => {
          const certNo = `${activeYear}${padSeq(nextSeq)}`;
          const isAttending = student.attending_convocation === true;
          const sessionVal = isAttending ? sessNum : null;
          const seatVal = isAttending ? nextSeat : null;

          valuesArr.push(sessionVal, seatVal, certNo, student.id);
          valueStrings.push(`($${pIndex}::integer, $${pIndex + 1}::integer, $${pIndex + 2}::text, $${pIndex + 3}::uuid)`);
          pIndex += 4;

          if (isAttending) {
            nextSeat++;
          }
          nextSeq++;
        });

        const bulkQuery = `
          UPDATE students AS s
          SET session_number = tmp.session_number,
              seat_number = tmp.seat_number,
              certificate_number = tmp.certificate_number
          FROM (
            VALUES ${valueStrings.join(', ')}
          ) AS tmp(session_number, seat_number, certificate_number, id)
          WHERE s.id = tmp.id
        `;

        await client.query(bulkQuery, valuesArr);
      }

      const startSeatVal = parseInt(maxSeatRes.rows[0].max_seat) + 1;
      return {
        faculty: targetGroup,
        sessionNumber: sessNum,
        allocatedCount: studentsList.length,
        startingSeat: startSeatVal,
        endingSeat: nextSeat > startSeatVal ? nextSeat - 1 : null,
      };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 400 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const group = searchParams.get("group");

    if (!group) {
      return NextResponse.json(
        { success: false, error: "Group parameter is required." },
        { status: 400 },
      );
    }

    await runAsAdmin(async (client) => {
      // Get the active convocation year
      const activeYearRes = await client.query(
        "SELECT convocation_year FROM registration_windows WHERE is_active = TRUE LIMIT 1",
      );
      const activeYear = activeYearRes.rows[0]?.convocation_year || "2026";

      if (group === "All External Degrees" || group === "External") {
        await client.query(
          `
          UPDATE students s
          SET session_number = NULL, seat_number = NULL, certificate_number = NULL
          FROM degrees d
          WHERE s.degree_id = d.id AND d.type = 'External' AND s.convocation_year = $1
        `,
          [activeYear],
        );
      } else if (group.endsWith(" (Internal)")) {
        const actualFaculty = group.replace(" (Internal)", "");
        await client.query(
          `
          UPDATE students s
          SET session_number = NULL, seat_number = NULL, certificate_number = NULL
          FROM degrees d
          WHERE s.degree_id = d.id AND s.faculty = $1 AND (d.type = 'Internal' OR d.type IS NULL) AND s.convocation_year = $2
        `,
          [actualFaculty, activeYear],
        );
      } else {
        // Legacy fallback
        await client.query(
          `
          UPDATE students s
          SET session_number = NULL, seat_number = NULL, certificate_number = NULL
          WHERE s.faculty = $1 AND s.convocation_year = $2
        `,
          [group, activeYear],
        );
      }
    });

    return NextResponse.json({
      success: true,
      message: `Successfully cleared session and seating allocation for ${group}.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
