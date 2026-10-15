import { z } from 'zod';
export const days = [{ id: 'mon', label: 'Mon' }, { id: 'tue', label: 'Tue' }, { id: 'wed', label: 'Wed Special' }] as const;
export type Day = typeof days[number]['id'];
export const rentUpdateSchema = z.object({ id: z.string().min(1), rent: z.number().int().min(1).max(1000000) });
export const mealUpdateSchema = z.object({ id: z.string().min(1), items: z.string().trim().min(1).max(1000) });
export function requireOwnerAccess(isOwner: boolean) { if (!isOwner) throw new Error('Only the verified owner can make changes.'); }
export function mealsForDay<T extends { day: string; sort_order: number }>(meals: T[], day: Day): T[] { return meals.filter(meal => meal.day === day).sort((a, b) => a.sort_order - b.sort_order); }
