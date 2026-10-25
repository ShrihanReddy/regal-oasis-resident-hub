import { z } from 'zod';
export const categories = ['Wi-Fi', 'Plumbing', 'Electrical', 'Cleaning'] as const;
export const paymentMethods = ['UPI', 'Bank Transfer', 'Cash'] as const;
export const ticketSchema = z.object({ room_number: z.string().trim().min(1).max(20), category: z.enum(categories), description: z.string().trim().min(5).max(2000) });
export const feedbackSchema = z.object({ message: z.string().trim().min(5).max(3000) });
export const allotmentSchema = z.object({ student_name: z.string().trim().min(1).max(100), room_number: z.string().trim().min(1).max(20) });
export const proofSchema = z.object({ allotment_id: z.string().uuid(), billing_month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(), payment_method: z.enum(paymentMethods), utr: z.string().trim().max(150), file: z.string().min(1).max(7000000), mime: z.enum(['image/png', 'image/jpeg', 'image/webp']) }).refine(d => d.payment_method === 'Cash' || d.utr.length > 0, { message: 'Enter the UTR transaction reference.', path: ['utr'] });
export function requireResident(unlocked: boolean | undefined) { if (!unlocked) throw new Error('Enter the student security code to continue.'); }