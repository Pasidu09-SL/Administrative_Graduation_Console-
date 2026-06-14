import crypto from 'crypto';
import { cookies } from 'next/headers';
import { runAsAdmin } from './db';

const SECRET = process.env.JWT_ACCESS_SECRET || 'university-graduation-system-secure-key-2026';

export interface AuthUser {
  email: string;
  index_no: string;
  convocation_year?: string;
  magicTokenExp?: number;
}

export function signToken(payload: AuthUser): string {
  const data = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', SECRET).update(data).digest('hex');
  return `${Buffer.from(data).toString('base64')}.${signature}`;
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const [dataBase64, signature] = token.split('.');
    if (!dataBase64 || !signature) return null;
    const data = Buffer.from(dataBase64, 'base64').toString('utf8');
    const expectedSignature = crypto.createHmac('sha256', SECRET).update(data).digest('hex');
    if (signature !== expectedSignature) return null;
    const payload = JSON.parse(data);
    if (payload.magicTokenExp && Date.now() > payload.magicTokenExp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * Validates if the current date (or mockTime override) is within the active registration window.
 */
export async function isRegistrationWindowOpen(mockTimeHeader?: string | null): Promise<{ isOpen: boolean; window: any }> {
  const activeWindow = await runAsAdmin(async (client) => {
    const res = await client.query(
      'SELECT open_date, close_date, is_manually_closed, convocation_year FROM registration_windows WHERE is_active = TRUE LIMIT 1'
    );
    if (res.rows.length > 0) return res.rows[0];
    const fallback = await client.query(
      'SELECT open_date, close_date, is_manually_closed, convocation_year FROM registration_windows ORDER BY id DESC LIMIT 1'
    );
    return fallback.rows[0] || null;
  });

  if (!activeWindow) {
    return { isOpen: false, window: null };
  }

  const checkTime = mockTimeHeader ? new Date(mockTimeHeader) : new Date();
  const openTime = new Date(activeWindow.open_date);
  const closeTime = new Date(activeWindow.close_date);

  const isScheduledOpen = checkTime >= openTime && checkTime <= closeTime;
  const isOpen = isScheduledOpen && !activeWindow.is_manually_closed;

  // Dynamically record automatic timeline open/close transitions if not manually closed
  if (!activeWindow.is_manually_closed) {
    try {
      await runAsAdmin(async (client) => {
        const lastLogRes = await client.query(`
          SELECT action_taken, timestamp 
          FROM audit_logs 
          WHERE admin_id = 'System' 
            AND (action_taken = 'Portal opened automatically' OR action_taken = 'Portal closed automatically')
          ORDER BY timestamp DESC LIMIT 1
        `);
        const lastLog = lastLogRes.rows[0];

        if (isScheduledOpen) {
          if (!lastLog || lastLog.action_taken === 'Portal closed automatically') {
            await client.query(
              "INSERT INTO audit_logs (admin_id, action_taken, student_id) VALUES ('System', 'Portal opened automatically', NULL)"
            );
          }
        } else {
          if (lastLog && lastLog.action_taken === 'Portal opened automatically') {
            await client.query(
              "INSERT INTO audit_logs (admin_id, action_taken, student_id) VALUES ('System', 'Portal closed automatically', NULL)"
            );
          }
        }
      });
    } catch (err) {
      console.error('Error logging automatic portal state transition:', err);
    }
  }

  return { isOpen, window: activeWindow };
}

export interface AuthAdmin {
  username: string;
  name: string;
  role: string;
}

export function signAdminToken(payload: AuthAdmin): string {
  const data = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', SECRET).update(data).digest('hex');
  return `${Buffer.from(data).toString('base64')}.${signature}`;
}

export function verifyAdminToken(token: string): AuthAdmin | null {
  try {
    const [dataBase64, signature] = token.split('.');
    if (!dataBase64 || !signature) return null;
    const data = Buffer.from(dataBase64, 'base64').toString('utf8');
    const expectedSignature = crypto.createHmac('sha256', SECRET).update(data).digest('hex');
    if (signature !== expectedSignature) return null;
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function getAdminSession(): Promise<AuthAdmin | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_session')?.value;
    if (!token) return null;
    return verifyAdminToken(token);
  } catch {
    return null;
  }
}

export function signMagicToken(email: string, index_no: string, convocation_year?: string): string {
  const payload = {
    email: email.toLowerCase().trim(),
    index_no: index_no.trim(),
    convocation_year: convocation_year ? convocation_year.trim() : undefined,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days expiry
  };
  const data = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', SECRET).update(data).digest('hex');
  return `${Buffer.from(data).toString('base64')}.${signature}`;
}

export function verifyMagicToken(token: string): { email: string; index_no: string; convocation_year?: string; exp: number } | null {
  try {
    const [dataBase64, signature] = token.split('.');
    if (!dataBase64 || !signature) return null;
    const data = Buffer.from(dataBase64, 'base64').toString('utf8');
    const expectedSignature = crypto.createHmac('sha256', SECRET).update(data).digest('hex');
    if (signature !== expectedSignature) return null;
    const payload = JSON.parse(data);
    if (Date.now() > payload.exp) return null;
    return {
      email: payload.email,
      index_no: payload.index_no,
      convocation_year: payload.convocation_year,
      exp: payload.exp
    };
  } catch {
    return null;
  }
}

