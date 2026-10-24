import { z } from 'zod';
export const days = [{ id: 'mon', label: 'Mon' }, { id: 'tue', label: 'Tue' }, { id: 'wed', label: 'Wed Special' }] as const;
export type Day = typeof days[number]['id'];
export const rentUpdateSchema = z.object({ id: z.string().min(1), rent: z.number().int().min(1).max(1000000) });
export const mealUpdateSchema = z.object({ id: z.string().min(1), items: z.string().trim().min(1).max(1000) });
export function requireOwnerAccess(isOwner: boolean) { if (!isOwner) throw new Error('Only the verified owner can make changes.'); }
export function mealsForDay<T extends { day: string; sort_order: number }>(meals: T[], day: Day): T[] { return meals.filter(meal => meal.day === day).sort((a, b) => a.sort_order - b.sort_order); }

export const weeks = [1, 2, 3, 4] as const;
export type Week = typeof weeks[number];
export const fullDays = [
  { id: 'mon', label: 'Monday' }, { id: 'tue', label: 'Tuesday' },
  { id: 'wed', label: 'Wednesday' }, { id: 'thu', label: 'Thursday' },
  { id: 'fri', label: 'Friday' }, { id: 'sat', label: 'Saturday' },
  { id: 'sun', label: 'Sunday' },
] as const;
export const mealNames = ['Breakfast','Lunch','Evening Snacks','Dinner'] as const;
export function mealsForWeek<T extends { week_number: number; day: string; sort_order: number }>(rows: T[], week: Week): T[] {
  return rows.filter(row => row.week_number === week).sort((a,b) =>
    fullDays.findIndex(d => d.id === a.day) - fullDays.findIndex(d => d.id === b.day) || a.sort_order - b.sort_order);
}
