import { useSession, setResponseHeader } from '@tanstack/react-start/server';
export async function residentSession() {
  const password = process.env['RESIDENT_SESSION_SECRET'];
  if (!password) throw new Error('Resident access is temporarily unavailable.');
  setResponseHeader('Cache-Control', 'no-store');
  return useSession<{ unlocked?: boolean; attempts?: number; blockedUntil?: number; lastSubmit?: number }>({ password, name: 'regal-resident', maxAge: 60 * 60 * 8, cookie: { httpOnly: true, secure: true, sameSite: 'lax', path: '/' } });
}