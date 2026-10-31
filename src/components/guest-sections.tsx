import { useState, type FormEvent } from 'react';
import { PropertyGallery } from './property-gallery';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { BedDouble, Wind, Users, Utensils, Pencil, Save, X, Check, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { weeks, fullDays, mealNames, mealsForWeek, type Week } from '@/lib/guest-schema';
import { guestQueryOptions, updateRent, updateMeal } from '@/lib/guest.functions';
import type { Tables } from '@/integrations/supabase/types';

function RentCard({ room, editable }: { room: Tables<'accommodations'>; editable: boolean }) {
  const [editing, setEditing] = useState(false);
  const [rent, setRent] = useState(String(room.rent));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const save = useServerFn(updateRent);
  const queryClient = useQueryClient();
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('');
    try { await save({ data: { id: room.id, rent: Number(rent) } }); await queryClient.invalidateQueries({ queryKey: guestQueryOptions.queryKey }); setEditing(false); setMessage('Rent saved'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save rent.'); }
    finally { setBusy(false); }
  }
  return <article className={`tariff-card ${room.id === 'three-ac' ? 'featured-tariff' : ''}`}>
    <div className="tariff-top"><span className="room-icon">{room.id === 'three-ac' ? <Wind size={22} /> : <BedDouble size={22} />}</span><span className="room-tag">{room.id === 'three-ac' ? 'AIR-CONDITIONED' : 'SHARED LIVING'}</span></div>
    <h3>{room.title}</h3><p className="room-subtitle">{room.id === 'two-sharing' ? 'A little more room for you.' : room.id === 'three-ac' ? 'Your cool, comfortable retreat.' : 'Good company. Comfortable living.'}</p>
    {editing ? <form className="rent-form" onSubmit={submit}><label htmlFor={`rent-${room.id}`}>Monthly rent (₹)</label><Input id={`rent-${room.id}`} type="number" min="1" max="1000000" step="1" value={rent} onChange={e => setRent(e.target.value)} required /><div className="edit-actions"><Button type="submit" disabled={busy}><Save />{busy ? 'Saving…' : 'Save rent'}</Button><Button variant="ghost" size="icon" aria-label="Cancel rent edit" onClick={() => setEditing(false)} disabled={busy}><X /></Button></div></form> : <div className="price">₹{room.rent.toLocaleString('en-IN')}<span>/ month</span></div>}
    <div className="room-details"><span><Users size={14} />{room.id === 'two-sharing' ? '2 residents per room' : '3 residents per room'}</span><span><Check size={14} />3 meals included</span></div>
    {editable && !editing && <Button className="edit-rent" variant="outline" onClick={() => { setRent(String(room.rent)); setEditing(true); setMessage(''); }}><Pencil />Edit rent</Button>}
    {!editable && <Button variant="ghost" className="room-menu-link" asChild><a href="#mess-menu">See what’s on the menu<ArrowDown size={14} /></a></Button>}
    {message && <p className="form-message" role="status">{message}</p>}
  </article>;
}
function WeeklyMenu({ menu, editable }: { menu: Tables<'weekly_mess_menu'>[]; editable: boolean }) {
  const [week, setWeek] = useState<Week>(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const save = useServerFn(updateMeal);
  const queryClient = useQueryClient();
  const weeklyMeals = mealsForWeek(menu, week);
const visibleMeals = mealNames.filter(
  name => !name.toLowerCase().includes('snack')
);
  async function submit(e: FormEvent, id: string) {
    e.preventDefault(); setBusy(true); setMessage('');
    try {
      await save({ data: { id, items: draft.trim() || 'Menu to be announced' } });
      await queryClient.invalidateQueries({ queryKey: guestQueryOptions.queryKey });
      setEditingId(null); setMessage('Menu updated successfully.');
    } catch(error) { setMessage(error instanceof Error ? error.message : 'Could not update menu.'); }
    finally { setBusy(false); }
  }
  return <>
    <div className="menu-toolbar">
      <div className="day-tabs" role="tablist" aria-label="Menu week">
        {weeks.map(w => <Button key={w} variant="ghost" role="tab" id={`week-tab-${w}`}
          aria-controls="weekly-menu-panel" aria-selected={week === w} tabIndex={week === w ? 0 : -1}
          onClick={() => { setWeek(w); setEditingId(null); setMessage(''); }}
          onKeyDown={e => { if(e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return; e.preventDefault();
            const next = weeks[(weeks.indexOf(week) + (e.key === 'ArrowRight' ? 1 : 3)) % 4]!;
            setWeek(next); setEditingId(null); document.getElementById(`week-tab-${next}`)?.focus(); }}>
          Week {w}
        </Button>)}
      </div>
      <span className="day-caption">{editable ? 'Select any meal to edit it.' : 'Our rotating four-week meal plan.'}</span>
    </div>
    <div className="weekly-menu-scroll" id="weekly-menu-panel" role="tabpanel" aria-labelledby={`week-tab-${week}`}>
      <table className="weekly-menu-table">
        <thead><tr><th scope="col">Day</th>{visibleMeals.map(name => <th key={name} scope="col">{name}</th>)}</tr></thead>
        <tbody>{fullDays.map(day => <tr key={day.id}><th scope="row">{day.label}</th>
          {visibleMeals.map(name => {
            const meal = weeklyMeals.find(item => item.day === day.id && item.meal === name);
            if (!meal) return <td key={name}>—</td>;
            return <td key={name}>
              {editable && editingId === meal.id ?
                <form className="weekly-meal-form" onSubmit={e => submit(e, meal.id)}>
                  <label className="sr-only" htmlFor={`edit-${meal.id}`}>{day.label} {name}</label>
                  <Textarea id={`edit-${meal.id}`} rows={3} maxLength={1000} value={draft} onChange={e => setDraft(e.target.value)} />
                  <div className="edit-actions"><Button type="submit" size="sm" disabled={busy}><Save size={14}/>Save</Button><Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setEditingId(null)}>Cancel</Button></div>
                </form> : <div className="weekly-meal-cell"><span>{meal.items || 'Menu to be announced'}</span>
                  {editable && <Button type="button" size="sm" variant="ghost" aria-label={`Edit ${day.label} ${name} week ${week}`} onClick={() => { setDraft(meal.items); setEditingId(meal.id); setMessage(''); }}><Pencil size={14}/></Button>}
                </div>}
            </td>;
          })}</tr>)}</tbody>
      </table>
    </div>
    {message && <p className="form-message" role="status">{message}</p>}
  </>;
}
export function GuestSections({ editable = false }: { editable?: boolean }) {
  const { data } = useSuspenseQuery(guestQueryOptions);
  return <>
    <section id={editable ? "accommodation-admin" : "accommodation"} className="guest-section accommodation-section"><div className="section-heading"><div><p className="small-label">01 / FIND YOUR SPACE</p><h2>{editable ? 'Accommodation tariffs' : 'A room for your next chapter.'}</h2></div><p>Three ways to make yourself at home.</p></div><div className="tariff-grid">{data.rooms.map(room => <RentCard key={room.id} room={room} editable={editable} />)}</div></section>
    <section id={editable ? "menu-admin" : "mess-menu"} className="guest-section menu-section"><div className="section-heading"><div><p className="small-label">02 / FRESH FROM THE KITCHEN</p><h2>{editable ? 'Edit the four-week mess menu' : 'Good food. Every day.'}</h2></div><span className="menu-note"><Utensils size={14} />A little taste of home.</span></div>
      <WeeklyMenu menu={data.menu} editable={editable}/>
    </section>
    <PropertyGallery editable={editable} />
  </>;
  }

