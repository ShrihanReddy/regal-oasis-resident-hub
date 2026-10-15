import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mealsForDay, rentUpdateSchema, mealUpdateSchema, requireOwnerAccess } from '@/lib/guest-schema';
const migration = readFileSync('drizzle/migrations/0000_guest_tariffs_menu_owner_access.sql', 'utf8');
describe('Guest tariffs and menu rules', () => {
 it('starts 3-sharing non-AC at 9000 rupees monthly', () => { expect(migration).toContain("'three-non-ac','3-Sharing Non-AC',9000"); });
 it('starts 3-sharing AC at 10000 rupees monthly', () => { expect(migration).toContain("'three-ac','3-Sharing AC',10000"); });
 it('starts 2-sharing at 9000 rupees monthly', () => { expect(migration).toContain("'two-sharing','2-Sharing',9000"); });
 it('returns only the selected day meals in meal order', () => {
 const rows = [{day:'mon',sort_order:2}, {day:'tue',sort_order:1}, {day:'mon',sort_order:1}];
 expect(mealsForDay(rows, 'mon')).toEqual([{day:'mon',sort_order:1},{day:'mon',sort_order:2}]);
 });
 it('seeds four meals for each requested day', () => {
 for (const day of ['mon', 'tue', 'wed']) for (const meal of ['Breakfast','Lunch','Evening Snacks','Dinner']) expect(migration).toContain(`'${day}','${meal}'`);
 });
 it('rejects non-owner edits', () => { expect(() => requireOwnerAccess(false)).toThrow(); expect(() => requireOwnerAccess(true)).not.toThrow(); });
 it('requires a verified designated owner in database policies', () => {
 expect(migration).toContain("u.email_confirmed_at IS NOT NULL AND lower(u.email) = 'workwithshrihan08@gmail.com'");
 expect(migration.match(/WITH CHECK \(public.has_role\(auth.uid\(\), 'owner'\)\)/g)).toHaveLength(2);
 expect(migration).not.toMatch(/GRANT (INSERT|UPDATE|ALL).*public.user_roles TO authenticated/);
 });
 it('validates editable rent and meal values', () => {
 expect(rentUpdateSchema.safeParse({id:'three-ac',rent:10000}).success).toBe(true);
 expect(rentUpdateSchema.safeParse({id:'three-ac',rent:-1}).success).toBe(false);
 expect(mealUpdateSchema.safeParse({id:'mon-breakfast',items:'   '}).success).toBe(false);
 });
});
