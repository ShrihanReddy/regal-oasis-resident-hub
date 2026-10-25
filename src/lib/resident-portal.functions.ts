import { createServerFn } from '@tanstack/react-start';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { residentSession } from './resident-session.server';

const uuid = z.string().uuid();
const submissionLimit = async () => {
  const session = await residentSession();
  if (Date.now() - (session.data.lastSubmit ?? 0) < 10000) throw Error('Please wait 10 seconds between submissions.');
  return session;
};
async function admin() { const { supabaseAdmin } = await import('@/integrations/supabase/client.server'); return supabaseAdmin; }
async function owner(context: {supabase: any; userId: string}) {
  const result = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'owner' });
  if (result.error || result.data !== true) throw Error('Owner access required.');
}
export const residentChoices = createServerFn({method:'GET'}).handler(async () => {
  const db=await admin() as any; const r=await db.from('student_allotments').select('id,student_name,room_number').eq('active',true).order('student_name');
  if(r.error) throw Error('Could not load residents.'); return r.data;
});
export const publicBoard = createServerFn({method:'GET'}).handler(async () => {
  const db=await admin() as any; const r=await db.from('public_maintenance_board').select('id,category,description,status,owner_reply,created_at,replied_at').order('created_at',{ascending:false}).limit(100);
  if(r.error) throw Error('Could not load noticeboard. Apply migration 0011.'); return r.data;
});
export const sendComplaint = createServerFn({method:'POST'}).inputValidator(v=>z.object({allotment_id:uuid,category:z.enum(['Electrical','Plumbing','Food','Miscellaneous']),description:z.string().trim().min(10).max(1500)}).parse(v)).handler(async ({data}) => {
  const session=await submissionLimit(); const db=await admin() as any;
  const resident=await db.from('student_allotments').select('room_number').eq('id',data.allotment_id).eq('active',true).single();
  if(resident.error || !resident.data) throw Error('Please choose an active resident.');
  const r=await db.from('maintenance_tickets').insert({...data,room_number:resident.data.room_number}).select('id').single();
  if(r.error) throw Error('Unable to submit complaint.'); await session.update({lastSubmit:Date.now()}); return r.data;
});
export const sendAnonymous = createServerFn({method:'POST'}).inputValidator(v=>z.object({message:z.string().trim().min(10).max(1500)}).parse(v)).handler(async ({data})=>{
  const session=await submissionLimit();const code=randomBytes(18).toString('base64url');const tracking_hash=createHash('sha256').update(code).digest('hex');const db=await admin() as any;
  const r=await db.from('anonymous_feedback').insert({message:data.message,tracking_hash});
  if(r.error) throw Error('Unable to submit anonymous complaint.');await session.update({lastSubmit:Date.now()});return {code};
});
export const checkAnonymous = createServerFn({method:'POST'}).inputValidator(v=>z.object({code:z.string().min(16).max(100)}).parse(v)).handler(async ({data})=>{
  const db=await admin() as any;const tracking_hash=createHash('sha256').update(data.code).digest('hex');const r=await db.from('anonymous_feedback').select('message,owner_reply,created_at,replied_at').eq('tracking_hash',tracking_hash).maybeSingle();
  if(r.error || !r.data) throw Error('No complaint matches that reference code.');return r.data;
});
export const sendProof = createServerFn({method:'POST'}).inputValidator(v=>z.object({allotment_id:uuid,billing_month:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),payment_method:z.enum(['UPI','Bank Transfer','Cash']),utr:z.string().trim().max(150),file:z.string().min(1).max(7000000),mime:z.enum(['image/png','image/jpeg','image/webp'])}).parse(v)).handler(async ({data})=>{
  const session=await submissionLimit();const db=await admin() as any;
  const resident=await db.from('student_allotments').select('id').eq('id',data.allotment_id).eq('active',true).single();if(resident.error)throw Error('Choose an active resident.');
  const bytes=Uint8Array.from(atob(data.file),c=>c.charCodeAt(0));
  const valid=data.mime==='image/png' ? bytes.length>8&&bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71 : data.mime==='image/jpeg' ? bytes.length>3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255 : bytes.length>12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
  if(!valid || bytes.length>5*1024*1024)throw Error('Choose a PNG, JPG, or WebP under 5 MB.');
  if(data.payment_method!=='Cash'&&!data.utr)throw Error('Enter the UTR for online payment.');
  const path=`${crypto.randomUUID()}.${data.mime==='image/jpeg'?'jpg':data.mime.split('/')[1]}`;
  const upload=await db.storage.from('rent-proofs').upload(path,bytes,{contentType:data.mime});if(upload.error)throw Error('Screenshot upload failed.');
  const r=await db.from('rent_proofs').insert({allotment_id:data.allotment_id,billing_month:`${data.billing_month}-01`,payment_method:data.payment_method,utr:data.utr,file_path:path}).select('id').single();
  if(r.error){await db.storage.from('rent-proofs').remove([path]);throw Error('Unable to save the proof.');}
  await session.update({lastSubmit:Date.now()});return r.data;
});
export const ownerResidentInbox = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async ({context})=>{
  await owner(context);const [tickets,feedback,allotments]=await Promise.all([
    (context.supabase as any).from('maintenance_tickets').select('id,allotment_id,room_number,category,description,status,owner_reply,created_at').order('created_at',{ascending:false}),
    (context.supabase as any).from('anonymous_feedback').select('id,message,owner_reply,created_at').order('created_at',{ascending:false}),
    context.supabase.from('student_allotments').select('id,student_name')]);
  if(tickets.error||feedback.error||allotments.error)throw Error('Could not load complaint inbox.');return {tickets:tickets.data,feedback:feedback.data,allotments:allotments.data};
});
export const ownerReplyComplaint = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(v=>z.object({id:uuid,reply:z.string().trim().max(2000),status:z.enum(['Pending','Resolved'])}).parse(v)).handler(async ({context,data})=>{
  await owner(context);const r=await (context.supabase as any).from('maintenance_tickets').update({owner_reply:data.reply||null,replied_at:data.reply?new Date().toISOString():null,status:data.status}).eq('id',data.id).select('id').single();
  if(r.error)throw Error('Could not save reply.');return r.data;
});
export const ownerReplyAnonymous = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(v=>z.object({id:uuid,reply:z.string().trim().min(1).max(2000)}).parse(v)).handler(async ({context,data})=>{
  await owner(context);const r=await (context.supabase as any).from('anonymous_feedback').update({owner_reply:data.reply,replied_at:new Date().toISOString()}).eq('id',data.id).select('id').single();
  if(r.error)throw Error('Could not save anonymous reply.');return r.data;
});
