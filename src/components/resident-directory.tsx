import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './auth-context';
import { supabase } from '@/integrations/supabase/client';
import { Button } from './ui/button';

const key = ['owner-resident-directory'];
type Resident = { id: string; student_name: string; room_number: string; active: boolean; sharing_type: number | null; has_ac: boolean };
async function verifyOwner(userId: string) {
  const { data, error } = await supabase.rpc('has_role', { _user_id: userId, _role: 'owner' });
  if (error || data !== true) throw new Error('Owner permission could not be verified.');
}
async function fetchResidents(userId: string): Promise<Resident[]> {
  await verifyOwner(userId);
  const { data, error } = await supabase.from('student_allotments')
    .select('id,student_name,room_number,active,sharing_type,has_ac').order('student_name');
  if (error) throw error;
  return data;
}
const blank = { student_name: '', room_number: '', sharing_type: '2', has_ac: false };
export function ResidentDirectory() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const { data = [], isPending, error } = useQuery({ queryKey: [...key, user?.id], queryFn: () => fetchResidents(user!.id), enabled: !!user });
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  function open(resident?: Resident) {
    setEditing(resident?.id ?? 'new');
    setForm(resident ? { student_name: resident.student_name, room_number: resident.room_number, sharing_type: String(resident.sharing_type ?? 2), has_ac: resident.has_ac } : blank);
    setMessage('');
  }
  async function save(e: FormEvent) {
    e.preventDefault(); if (!user) return;
    setBusy(true); setMessage('');
    try {
      await verifyOwner(user.id);
      const payload = { student_name: form.student_name.trim(), room_number: form.room_number.trim(), sharing_type: Number(form.sharing_type), has_ac: form.has_ac };
      if (!payload.student_name || !payload.room_number) throw new Error('Enter both a student name and a room number.');
      const result = editing === 'new' ? await supabase.from('student_allotments').insert(payload) : await supabase.from('student_allotments').update(payload).eq('id', editing!);
      if (result.error) throw result.error;
      setEditing(null); await refresh(); setMessage('Resident saved.');
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Unable to save resident.'); }
    finally { setBusy(false); }
  }
  async function changeStatus(r: Resident) {
    if (!user) return;
    if (r.active && !window.confirm(`Deactivate ${r.student_name}? Past records will be kept.`)) return;
    setBusy(true); setMessage('');
    try {
      await verifyOwner(user.id);
      const { error } = await supabase.from('student_allotments').update({ active: !r.active }).eq('id', r.id);
      if (error) throw error;
      await refresh(); setMessage(r.active ? 'Resident deactivated; history retained.' : 'Resident reactivated.');
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Unable to change status.'); }
    finally { setBusy(false); }
  }
  return <section className="guest-section" id="resident-directory" style={{ paddingBlock: '3rem' }}>
    <div className="section-heading"><div><p className="small-label">OWNER ADMIN / RESIDENT RECORDS</p><h2>Manage residents</h2></div><p>Add, edit or deactivate current residents. Previous rent records remain linked to their accounts.</p></div>
    <div style={{ display:'flex',justifyContent:'space-between',gap:'1rem',flexWrap:'wrap',marginBottom:'1rem' }}><p>{data.filter(r=>r.active).length} active / {data.length} total residents</p><Button type="button" onClick={()=>open()}>+ Add resident</Button></div>
    {isPending ? <p>Loading residents…</p> : error ? <p role="alert">Unable to load residents. Check owner permissions and database migration.</p> :
    <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',textAlign:'left'}}><thead><tr>{['Name','Room','Accommodation','Status','Actions'].map(v=><th key={v} style={{padding:'0.85rem',borderBottom:'1px solid currentColor'}}>{v}</th>)}</tr></thead><tbody>{data.map(r=><tr key={r.id} style={{opacity:r.active?1:0.6}}><td style={{padding:'0.85rem'}}>{r.student_name}</td><td style={{padding:'0.85rem'}}>{r.room_number}</td><td style={{padding:'0.85rem'}}>{r.sharing_type ? `${r.sharing_type}-sharing` : 'Not assigned'} · {r.has_ac ? 'AC' : 'Non-AC'}</td><td style={{padding:'0.85rem'}}>{r.active?'Active':'Inactive'}</td><td style={{padding:'0.85rem',whiteSpace:'nowrap'}}><Button variant="outline" size="sm" onClick={()=>open(r)} disabled={busy}>Edit</Button>{' '}<Button variant="outline" size="sm" disabled={busy} onClick={()=>changeStatus(r)}>{r.active?'Deactivate':'Reactivate'}</Button></td></tr>)}</tbody></table>{!data.length && <p>No residents yet. Use Add resident to begin.</p>}</div>}
    {editing !== null && <form onSubmit={save} style={{marginTop:'1.5rem',padding:'1.5rem',border:'1px solid #a9a09a',borderRadius:'0.75rem',display:'grid',gap:'1rem',maxWidth:'550px'}}><h3>{editing==='new'?'Add resident':'Edit resident'}</h3>
      <label>Student name<input required maxLength={100} value={form.student_name} onChange={e=>setForm({...form,student_name:e.target.value})} style={{display:'block',width:'100%',padding:'0.7rem',color:'#111'}} /></label>
      <label>Room number<input required maxLength={20} value={form.room_number} onChange={e=>setForm({...form,room_number:e.target.value})} style={{display:'block',width:'100%',padding:'0.7rem',color:'#111'}} /></label>
      <label>Sharing<select value={form.sharing_type} onChange={e=>setForm({...form,sharing_type:e.target.value})} style={{display:'block',padding:'0.7rem',color:'#111'}}><option value="2">2-sharing</option><option value="3">3-sharing</option></select></label>
      <label style={{display:'flex',gap:'0.6rem',alignItems:'center'}}><input type="checkbox" checked={form.has_ac} onChange={e=>setForm({...form,has_ac:e.target.checked})}/>AC room</label>
      <div style={{display:'flex',gap:'0.8rem'}}><Button type="submit" disabled={busy}>{busy?'Saving…':'Save resident'}</Button><Button type="button" variant="outline" disabled={busy} onClick={()=>setEditing(null)}>Cancel</Button></div>
    </form>}
    {message && <p role="status" style={{marginTop:'1rem'}}>{message}</p>}
  </section>;
}
