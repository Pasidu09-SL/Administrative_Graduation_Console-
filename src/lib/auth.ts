import crypto from 'crypto';
import { cookies } from 'next/headers';
import { runAsAdmin } from './db';

const SECRET = process.env.JWT_ACCESS_SECRET || 'university-graduation-system-secure-key-2026';

export interface AuthUser {
  email: string;
  index_no: string;
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
      'SELECT open_date, close_date, is_manually_closed FROM registration_windows ORDER BY id DESC LIMIT 1'
    );
    return res.rows[0] || null;
  });

  if (!activeWindow) {
    return { isOpen: false, window: null };
  }

  const checkTime = mockTimeHeader ? new Date(mockTimeHeader) : new Date();
  const openTime = new Date(activeWindow.open_date);
  const closeTime = new Date(activeWindow.close_date);

  const isOpen = checkTime >= openTime && checkTime <= closeTime && !activeWindow.is_manually_closed;
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

export function signMagicToken(email: string, index_no: string): string {
  const payload = {
    email: email.toLowerCase().trim(),
    index_no: index_no.trim(),
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days expiry
  };
  const data = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', SECRET).update(data).digest('hex');
  return `${Buffer.from(data).toString('base64')}.${signature}`;
}

export function verifyMagicToken(token: string): { email: string; index_no: string; exp: number } | null {
  try {
    const [dataBase64, signature] = token.split('.');
    if (!dataBase64 || !signature) return null;
    const data = Buffer.from(dataBase64, 'base64').toString('utf8');
    const expectedSignature = crypto.createHmac('sha256', SECRET).update(data).digest('hex');
    if (signature !== expectedSignature) return null;
    const payload = JSON.parse(data);
    if (Date.now() > payload.exp) return null;
    return { email: payload.email, index_no: payload.index_no, exp: payload.exp };
  } catch {
    return null;
  }
}

