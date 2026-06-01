import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { runAsStudent } from '@/lib/db';
import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

export async function POST(req: Request) {
  try {
    // 1. Authenticate student
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('student_session')?.value;
    if (!sessionToken) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(sessionToken);
    if (!payload) {
      return NextResponse.json({ success: false, error: 'Unauthorized session' }, { status: 401 });
    }

    // Check lock status before allowing upload
    const isLocked = await runAsStudent(payload.email, async (client) => {
      const res = await client.query('SELECT attendance_confirmed FROM students WHERE email = $1', [payload.email]);
      return res.rows[0]?.attendance_confirmed || false;
    });

    if (isLocked) {
      return NextResponse.json({ success: false, error: 'Profile is locked. Uploads disabled.' }, { status: 403 });
    }

    // 2. Parse FormData
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string; // 'photo' or 'slip'

    if (!file || !type) {
      return NextResponse.json({ success: false, error: 'File and type (photo/slip) are required.' }, { status: 400 });
    }

    // 3. File size validation (max 2MB)
    const MAX_SIZE = 2 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ success: false, error: 'File size exceeds 2MB limit.' }, { status: 400 });
    }

    // 4. File extension and script masquerade validation
    const filename = file.name.toLowerCase();
    
    // Block executable script files and disguised extensions (e.g. malware.exe.png, script.js.jpeg)
    const forbiddenExtensions = ['.exe', '.sh', '.bat', '.js', '.py', '.scr', '.vbs', '.msi'];
    for (const ext of forbiddenExtensions) {
      if (filename.includes(ext)) {
        return NextResponse.json({
          success: false,
          error: 'Security alert: Upload of script files or disguised executables is strictly prohibited.'
        }, { status: 400 });
      }
    }

    const fileExt = path.extname(filename);
    const validPhotoExts = ['.png', '.jpg', '.jpeg'];
    const validSlipExts = ['.png', '.jpg', '.jpeg', '.pdf'];

    if (type === 'photo' && !validPhotoExts.includes(fileExt)) {
      return NextResponse.json({ success: false, error: 'Invalid photo format. Only PNG, JPG, and JPEG are allowed.' }, { status: 400 });
    }

    if (type === 'slip' && !validSlipExts.includes(fileExt)) {
      return NextResponse.json({ success: false, error: 'Invalid payment slip format. Only PNG, JPG, JPEG, and PDF are allowed.' }, { status: 400 });
    }

    // 5. Save file locally
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }

    const uniqueFilename = `${payload.index_no.replace(/[^a-zA-Z0-9]/g, '_')}_${type}_${Date.now()}${fileExt}`;
    const filePath = path.join(UPLOAD_DIR, uniqueFilename);
    
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    const relativeUrl = `/uploads/${uniqueFilename}`;

    return NextResponse.json({
      success: true,
      url: relativeUrl
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
