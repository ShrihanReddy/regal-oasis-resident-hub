import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync('drizzle/migrations/0010_protect_kitchen_stock_history.sql', 'utf8');
const body = (name: string) => {
  const match = sql.match(new RegExp(`FUNCTION public\\.${name}\\([\\s\\S]*?AS \\$\\$([\\s\\S]*?)END \\$\\$;`));
  if (!match?.[1]) throw new Error(`Missing function ${name}`);
  return match[1];
};

describe('Kitchen database protections', () => {
  it('authorizes all three stock operations through the existing owner role', () => {
    for (const name of ['kitchen_change_stock', 'kitchen_prepare', 'kitchen_reverse_preparation']) {
      expect(body(name)).toContain("IF NOT public.has_role(auth.uid(), 'owner') THEN RAISE EXCEPTION");
    }
  });
  it('removes direct stock and history write privileges while retaining ingredient creation', () => {
    expect(sql).toContain('REVOKE ALL ON public.pantry_ingredients FROM anon, authenticated;');
    expect(sql).toContain('GRANT INSERT (name, unit, low_stock), UPDATE (name, low_stock)');
    expect(sql).toContain('REVOKE ALL ON public.kitchen_stock_events, public.kitchen_preparations FROM anon, authenticated;');
    expect(sql).not.toMatch(/GRANT (?:ALL|INSERT|UPDATE|DELETE).*kitchen_stock_events.*TO authenticated/);
  });
  it('locks stock and writes its history inside each operation without swallowing failures', () => {
    for (const name of ['kitchen_change_stock', 'kitchen_prepare', 'kitchen_reverse_preparation']) {
      expect(body(name)).toContain('FOR UPDATE');
      expect(body(name)).toContain('INSERT INTO public.kitchen_stock_events');
      expect(body(name)).not.toMatch(/EXCEPTION\s+WHEN/i);
    }
  });
  it('restores original preparation deltas and prevents repeat reversal', () => {
    expect(body('kitchen_reverse_preparation')).toContain('rec.reversed_at IS NOT NULL');
    expect(body('kitchen_reverse_preparation')).toContain('SET stock=stock-ev.delta');
    expect(body('kitchen_reverse_preparation')).not.toContain('kitchen_recipe_ingredients');
  });
});