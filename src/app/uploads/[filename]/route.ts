import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function GET(
  req: Request,
  { params }: { params: any }
) {
  try {
    const resolvedParams = await params;
    const filename = resolvedParams.filename;
    
    if (!filename) {
      return new Response('Filename is required', { status: 400 });
    }

    // Sanitize filename to prevent path traversal attacks
    const safeFilename = path.basename(filename);
    const filePath = path.join(process.cwd(), 'public', 'uploads', safeFilename);

    if (!fs.existsSync(filePath)) {
      return new Response('Not Found', { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    const ext = path.extname(safeFilename).toLowerCase();
    
    let contentType = 'application/octet-stream';
    if (ext === '.jpg' || ext === '.jpeg') {
      contentType = 'image/jpeg';
    } else if (ext === '.png') {
      contentType = 'image/png';
    } else if (ext === '.pdf') {
      contentType = 'application/pdf';
    }

    return new Response(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err: any) {
    return new Response(err.message, { status: 500 });
  }
}
