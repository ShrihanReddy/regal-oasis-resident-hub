import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { queryOptions } from '@tanstack/react-query';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { requireOwnerAccess } from './guest-schema';
import { residentSession } from './resident-session.server';
import { ticketSchema, feedbackSchema, proofSchema, allotmentSchema, requireResident } from './resident-schema';

export const unlockResident = createServerFn({ method: 'POST' }).inputValidator(input => z.object({ code: z.string().min(1).max(100) }).parse(input)).handler(async ({ data }) => {
  const session = await residentSession();
  if ((session.data.blockedUntil ?? 0) > Date.now()) return { ok: false, error: 'Too many attempts. Try again in one minute.' };
  const expected = process.env['RESIDENT_CODE'];
  if (!expected) throw new Error('Resident access is temporarily unavailable.');
  const ok = timingSafeEqual(createHash('sha256').update(data.code).digest(), createHash('sha256').update(expected).digest());
  if (!ok) { const attempts = (session.data.attempts ?? 0) + 1; await session.update({ attempts: attempts >= 5 ? 0 : attempts, blockedUntil: attempts >= 5 ? Date.now() + 60000 : 0 }); return { ok: false, error: 'Incorrect security code.' }; }
  await session.update({ unlocked: true, attempts: 0, blockedUntil: 0 });
  return { ok: true, error: '' };
});
export const getResidentAccess = createServerFn({ method: 'GET' }).handler(async () => ({ unlocked: (await residentSession()).data.unlocked === true }));
export const lockResident = createServerFn({ method: 'POST' }).handler(async () => { await (await residentSession()).clear(); return { ok: true }; });
export const getMaintenanceBoard = createServerFn({ method: 'GET' }).handler(async () => {
  const url = process.env['SUPABASE_URL']; const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
  if (!url || !key) throw new Error('Maintenance board is unavailable.');
  const client = createClient(url, key, { auth: { persistSession: false }, global: { fetch: (input, init) => { const headers = new Headers(init?.headers); if (key.startsWith('sb_') && headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization'); headers.set('apikey', key); return fetch(input, { ...init, headers }); } } });
  const result = await client.from('maintenance_tickets').select('id,room_number,category,description,status,created_at').order('created_at', { ascending: false });
  if (result.error) throw new Error('Could not load maintenance tickets.');
  return result.data as { id: string; room_number: string; category: string; description: string; status: string; created_at: string }[];
});
export const boardQueryOptions = queryOptions({ queryKey: ['maintenance-board'], queryFn: () => getMaintenanceBoard(), refetchInterval: 5000 });
export const getResidentAllotments = createServerFn({ method: 'GET' }).handler(async () => {
  requireResident((await residentSession()).data.unlocked);
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const result = await supabaseAdmin.from('student_allotments').select('id,student_name,room_number').eq('active', true).order('student_name');
  if (result.error) throw new Error('Could not load student allotments.'); return result.data;
});
export const submitTicket = createServerFn({ method: 'POST' }).inputValidator(input => ticketSchema.parse(input)).handler(async ({ data }) => {
  const session = await residentSession(); requireResident(session.data.unlocked);
  if (Date.now() - (session.data.lastSubmit ?? 0) < 3000) throw new Error('Please wait a moment before submitting again.');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const result = await supabaseAdmin.from('maintenance_tickets').insert(data).select('id').single();
  if (result.error) throw new Error('Ticket could not be submitted.'); await session.update({ lastSubmit: Date.now() }); return result.data;
});
export const submitFeedback = createServerFn({ method: 'POST' }).inputValidator(input => feedbackSchema.parse(input)).handler(async ({ data }) => {
  const session = await residentSession(); requireResident(session.data.unlocked);
  if (Date.now() - (session.data.lastSubmit ?? 0) < 3000) throw new Error('Please wait a moment before submitting again.');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const result = await supabaseAdmin.from('anonymous_feedback').insert({ message: data.message }).select('id').single();
  if (result.error) throw new Error('Feedback could not be submitted.'); await session.update({ lastSubmit: Date.now() }); return { ok: true };
});
export const submitRentProof = createServerFn({ method: 'POST' }).inputValidator(input => proofSchema.parse(input)).handler(async ({ data }) => {
  requireResident((await residentSession()).data.unlocked);
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const allotment = await supabaseAdmin.from('student_allotments').select('id').eq('id', data.allotment_id).eq('active', true).single();
  if (allotment.error || !allotment.data) throw new Error('Select an active student allotment.');
  const bytes = Uint8Array.from(atob(data.file), c => c.charCodeAt(0));
  const valid = data.mime === 'image/png' ? bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71 : data.mime === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  if (!valid || bytes.length > 5 * 1024 * 1024) throw new Error('Choose a PNG, JPEG or WebP screenshot under 5 MB.');
  const path = `${crypto.randomUUID()}.${data.mime.split('/')[1]}`;
  const upload = await supabaseAdmin.storage.from('rent-proofs').upload(path, bytes, { contentType: data.mime });
  if (upload.error) throw new Error('Screenshot could not be uploaded.');
  const result = await supabaseAdmin.from('rent_proofs').insert({ allotment_id: data.allotment_id, billing_month: `${data.billing_month ?? new Date().toISOString().slice(0,7)}-01`, payment_method: data.payment_method, utr: data.utr, file_path: path }).select('id').single();
  if (result.error) { await supabaseAdmin.storage.from('rent-proofs').remove([path]); throw new Error('Rent proof could not be saved.'); } return result.data;
});
export const getOwnerSubmissions = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const access = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'owner' }); requireOwnerAccess(!access.error && access.data === true);
  const [allotments, proofs, feedback] = await Promise.all([context.supabase.from('student_allotments').select('id,student_name,room_number,active').order('student_name'), context.supabase.from('rent_proofs').select('id,allotment_id,payment_method,utr,file_path,created_at').order('created_at', { ascending: false }), context.supabase.from('anonymous_feedback').select('id,message,created_at').order('created_at', { ascending: false })]);
  if (allotments.error || proofs.error || feedback.error) throw new Error('Could not load resident submissions.');
  return { allotments: allotments.data, proofs: proofs.data, feedback: feedback.data };
});
export const addAllotment = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(input => allotmentSchema.parse(input)).handler(async ({ context, data }) => {
  const access = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'owner' }); requireOwnerAccess(!access.error && access.data === true);
  const result = await context.supabase.from('student_allotments').insert(data).select('id').single(); if (result.error) throw new Error('Allotment could not be saved.'); return result.data;
});
export const changeTicketStatus = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(input => z.object({ id: z.string().uuid(), status: z.enum(['Pending', 'Resolved']) }).parse(input)).handler(async ({ context, data }) => {
  const access = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'owner' }); requireOwnerAccess(!access.error && access.data === true);
  const result = await context.supabase.from('maintenance_tickets').update({ status: data.status }).eq('id', data.id).select('id').single(); if (result.error) throw new Error('Status could not be saved.'); return result.data;
});
export const getProofUrl = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(input => z.object({ id: z.string().uuid() }).parse(input)).handler(async ({ context, data }) => {
  const access = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'owner' }); requireOwnerAccess(!access.error && access.data === true);
  const proof = await context.supabase.from('rent_proofs').select('file_path').eq('id', data.id).single(); if (proof.error) throw new Error('Proof not found.');
  const result = await context.supabase.storage.from('rent-proofs').createSignedUrl(proof.data.file_path, 60); if (result.error) throw new Error('Screenshot unavailable.'); return { url: result.data.signedUrl.replace(process.env['SUPABASE_URL'] ?? '', import.meta.env.VITE_SUPABASE_URL) };
});
// Archive cleanup is deliberately owner-only and limited to a completed calendar year.
// Do not use until the owner has downloaded and checked the ZIP containing every proof.
export const deleteArchivedRentYear = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({ year: z.number().int().min(2020).max(2100), confirmation: z.string() }).parse(input))
  .handler(async ({ context, data }) => {
    const access = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'owner' });
    requireOwnerAccess(!access.error && access.data === true);
    const currentYear = new Date().getUTCFullYear();
    if (data.year >= currentYear) throw new Error('Only completed years can be cleared.');
    if (data.confirmation !== `DELETE ${data.year} RENT PROOFS`) throw new Error('Confirmation phrase does not match.');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const from = `${data.year}-01-01`, to = `${data.year + 1}-01-01`;
    const { data: proofs, error } = await supabaseAdmin.from('rent_proofs')
      .select('id,file_path').gte('billing_month', from).lt('billing_month', to);
    if (error) throw new Error('Could not inspect archived proofs.');
    // Remove screenshot objects first. If removal fails, leave database records intact.
    for (let i=0;i<proofs.length;i+=50) {
      const paths=proofs.slice(i,i+50).map(p=>p.file_path);
      const removed = await supabaseAdmin.storage.from('rent-proofs').remove(paths);
      if (removed.error) throw new Error('Storage deletion failed. Some files may have been removed; no database records were deleted.');
    }
    const ids=proofs.map(p=>p.id);
    for (let i=0;i<ids.length;i+=100) {
      const result=await supabaseAdmin.from('rent_proofs').delete().in('id',ids.slice(i,i+100));
      if (result.error) throw new Error('Some records could not be removed. Investigate before retrying.');
    }
    return { deleted: ids.length };
  });
