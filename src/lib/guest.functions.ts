import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import { queryOptions } from '@tanstack/react-query';
import type { Database } from '@/integrations/supabase/types';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { mealUpdateSchema, rentUpdateSchema, requireOwnerAccess } from './guest-schema';

export const getGuestData = createServerFn({ method: 'GET' }).handler(async () => {
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
  if (!url || !key) throw new Error('Property details are temporarily unavailable.');
  const client = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => {
    const headers = new Headers(init?.headers);
    if (key.startsWith('sb_') && headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization');
    headers.set('apikey', key);
    return fetch(input, { ...init, headers });
  } } });
  const [rooms, menu] = await Promise.all([client.from('accommodations').select('id,title,rent,sort_order').order('sort_order'), client.from('weekly_mess_menu').select('id,week_number,day,meal,items,sort_order').order('week_number').order('sort_order')]);
  if (rooms.error || menu.error) throw new Error('Could not load rents and meals. Please try again.');
  return { rooms: rooms.data, menu: menu.data };
});
export const guestQueryOptions = queryOptions({ queryKey: ['guest-data'], queryFn: () => getGuestData(), staleTime: 0 });
export const getOwnerAccess = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'owner' });
  if (error) throw new Error('Could not verify owner access.');
  return { isOwner: data === true };
});
export const updateRent = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(input => rentUpdateSchema.parse(input)).handler(async ({ context, data }) => {
  const access = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'owner' });
  requireOwnerAccess(!access.error && access.data === true);
  const result = await context.supabase.from('accommodations').update({ rent: data.rent }).eq('id', data.id).select('id,rent').single();
  if (result.error) throw new Error('Rent could not be saved. Please try again.');
  return result.data;
});
export const updateMeal = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(input => mealUpdateSchema.parse(input)).handler(async ({ context, data }) => {
  const access = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'owner' });
  requireOwnerAccess(!access.error && access.data === true);
  const result = await context.supabase.from('weekly_mess_menu').update({ items: data.items }).eq('id', data.id).select('id,items').single();
  if (result.error) throw new Error('Meal could not be saved. Please try again.');
  return result.data;
});
