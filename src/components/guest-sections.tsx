import { useState, type FormEvent } from 'react';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { BedDouble, Wind, Users, Coffee, Utensils, Cookie, Moon, Sparkles, Pencil, Save, X, Check, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { days, mealsForDay, type Day } from '@/lib/guest-schema';
import { guestQueryOptions, updateRent, updateMeal } from '@/lib/guest.functions';
import type { Tables } from '@/integrations/supabase/types';
const mealIcons = { Breakfast: Coffee, Lunch: Utensils, 'Evening Snacks': Cookie, Dinner: Moon };

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
function MealCard({ meal, editable }: { meal: Tables<'mess_menu'>; editable: boolean }) {
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState(meal.items);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const save = useServerFn(updateMeal);
  const queryClient = useQueryClient();
  const Icon = mealIcons[meal.meal as keyof typeof mealIcons] ?? Utensils;
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('');
    try { await save({ data: { id: meal.id, items } }); await queryClient.invalidateQueries({ queryKey: guestQueryOptions.queryKey }); setEditing(false); setMessage('Menu saved'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save menu.'); }
    finally { setBusy(false); }
  }
  return <article className="meal-card"><div className="meal-top"><Icon size={21} strokeWidth={1.5} /><span className="meal-number">0{meal.sort_order}</span></div><h3>{meal.meal}</h3>
    {editing ? <form onSubmit={submit}><label htmlFor={`meal-${meal.id}`}>Meal items</label><Textarea id={`meal-${meal.id}`} value={items} onChange={e => setItems(e.target.value)} maxLength={1000} required /><div className="edit-actions"><Button type="submit" disabled={busy}><Save />{busy ? 'Saving…' : 'Save menu'}</Button><Button variant="ghost" size="icon" aria-label="Cancel menu edit" disabled={busy} onClick={() => setEditing(false)}><X /></Button></div></form> : <p className="meal-items">{meal.items}</p>}
    {editable && !editing && <Button variant="ghost" className="edit-meal" onClick={() => { setItems(meal.items); setEditing(true); setMessage(''); }}><Pencil size={14} />Edit meal</Button>}
    {message && <p className="form-message" role="status">{message}</p>}
  </article>;
}
export function GuestSections({ editable = false }: { editable?: boolean }) {
  const { data } = useSuspenseQuery(guestQueryOptions);
  const [day, setDay] = useState<Day>('mon');
  const meals = mealsForDay(data.menu, day);
  return <>
    <section id="accommodation" className="guest-section accommodation-section"><div className="section-heading"><div><p className="small-label">01 / FIND YOUR SPACE</p><h2>{editable ? 'Accommodation tariffs' : 'A room for your next chapter.'}</h2></div><p>Three ways to make yourself at home.</p></div><div className="tariff-grid">{data.rooms.map(room => <RentCard key={room.id} room={room} editable={editable} />)}</div></section>
    <section id="mess-menu" className="guest-section menu-section"><div className="section-heading"><div><p className="small-label">02 / FRESH FROM THE KITCHEN</p><h2>{editable ? 'Mess menu' : 'Good food. Every day.'}</h2></div><span className="menu-note"><Utensils size={14} />A little taste of home.</span></div>
    <div className="menu-toolbar"><div className="day-tabs" role="tablist" aria-label="Mess menu day">{days.map(d => <Button variant="ghost" role="tab" id={`tab-${d.id}`} aria-controls="day-menu" aria-selected={day === d.id} key={d.id} onClick={() => setDay(d.id)} onKeyDown={e => { if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return; e.preventDefault(); const i = days.findIndex(v => v.id === day); const next = days[(i + (e.key === 'ArrowRight' ? 1 : 2)) % 3]; setDay(next.id); document.getElementById(`tab-${next.id}`)?.focus(); }} tabIndex={day === d.id ? 0 : -1}>{d.id === 'wed' && <Sparkles size={14} />}{d.label}</Button>)}</div><span className="day-caption">{day === 'wed' ? 'Something a little special.' : 'Made for your everyday.'}</span></div>
    <div className="meal-grid" id="day-menu" role="tabpanel" aria-labelledby={`tab-${day}`} aria-live="polite">{meals.map(meal => <MealCard key={meal.id} meal={meal} editable={editable} />)}</div>
    </section>
  </>;
}
