-- Preserve the existing frontend API; stock and history writes are RPC-only.
REVOKE ALL ON public.pantry_ingredients FROM anon, authenticated;
GRANT SELECT ON public.pantry_ingredients TO authenticated;
GRANT INSERT (name, unit, low_stock), UPDATE (name, low_stock) ON public.pantry_ingredients TO authenticated;
REVOKE ALL ON public.kitchen_stock_events, public.kitchen_preparations FROM anon, authenticated;
GRANT SELECT ON public.kitchen_stock_events, public.kitchen_preparations TO authenticated;
REVOKE ALL ON public.kitchen_recipes, public.kitchen_recipe_ingredients FROM anon;
GRANT ALL ON public.pantry_ingredients, public.kitchen_recipes, public.kitchen_recipe_ingredients, public.kitchen_stock_events, public.kitchen_preparations TO service_role;

CREATE OR REPLACE FUNCTION public.kitchen_change_stock(p_ingredient uuid, p_delta numeric, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE current_stock numeric;
BEGIN
 IF NOT public.has_role(auth.uid(), 'owner') THEN RAISE EXCEPTION 'Owner access required'; END IF;
 IF p_delta IS NULL OR p_delta::text IN ('NaN','Infinity','-Infinity') OR p_delta = 0 OR p_delta <> round(p_delta,3)
 OR p_reason IS NULL OR p_reason NOT IN ('restock','adjustment') OR (p_reason='restock' AND p_delta < 0)
 THEN RAISE EXCEPTION 'Invalid stock change'; END IF;
 SELECT stock INTO current_stock FROM public.pantry_ingredients WHERE id=p_ingredient FOR UPDATE;
 IF NOT FOUND OR current_stock+p_delta < 0 THEN RAISE EXCEPTION 'Insufficient stock or missing ingredient'; END IF;
 UPDATE public.pantry_ingredients SET stock=stock+p_delta WHERE id=p_ingredient;
 INSERT INTO public.kitchen_stock_events(ingredient_id,delta,reason,actor_id) VALUES(p_ingredient,p_delta,p_reason,auth.uid());
END $$;

CREATE OR REPLACE FUNCTION public.kitchen_prepare(p_recipe uuid,p_quantity numeric,p_date date DEFAULT current_date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rec record; ingredient record; new_id uuid; needed numeric; available numeric;
BEGIN
 IF NOT public.has_role(auth.uid(), 'owner') THEN RAISE EXCEPTION 'Owner access required'; END IF;
 IF p_quantity IS NULL OR p_quantity::text IN ('NaN','Infinity','-Infinity') OR p_quantity <= 0 OR p_quantity > 100000
 OR p_quantity <> round(p_quantity,3) OR p_date IS NULL THEN RAISE EXCEPTION 'Invalid preparation quantity/date'; END IF;
 -- Capture the header and all component quantities in ONE MVCC statement.
 -- Concurrent recipe edits cannot change the definition between checks and deductions.
 SELECT r.id,r.name,r.yield_unit,r.base_yield,
 (SELECT jsonb_agg(jsonb_build_object('id',ri.ingredient_id,'quantity',ri.quantity) ORDER BY ri.ingredient_id)
 FROM public.kitchen_recipe_ingredients ri WHERE ri.recipe_id=r.id) AS parts
 INTO rec FROM public.kitchen_recipes r WHERE r.id=p_recipe;
 IF NOT FOUND THEN RAISE EXCEPTION 'Recipe not found'; END IF;
 IF rec.parts IS NULL THEN RAISE EXCEPTION 'Recipe has no ingredients'; END IF;
 INSERT INTO public.kitchen_preparations(recipe_id,recipe_name,quantity,unit,prepared_on,actor_id)
 VALUES(rec.id,rec.name,p_quantity,rec.yield_unit,p_date,auth.uid()) RETURNING id INTO new_id;
 -- Stable locking order avoids double spending and deadlocks across recipes.
 FOR ingredient IN SELECT * FROM jsonb_to_recordset(rec.parts) AS part(id uuid,quantity numeric) ORDER BY id LOOP
 needed := round(ingredient.quantity*p_quantity/rec.base_yield,3);
 SELECT stock INTO available FROM public.pantry_ingredients WHERE id=ingredient.id FOR UPDATE;
 IF NOT FOUND OR needed <= 0 OR available < needed THEN RAISE EXCEPTION 'Insufficient stock for ingredient %',ingredient.id; END IF;
 UPDATE public.pantry_ingredients SET stock=stock-needed WHERE id=ingredient.id;
 INSERT INTO public.kitchen_stock_events(ingredient_id,delta,reason,production_id,actor_id)
 VALUES(ingredient.id,-needed,'preparation',new_id,auth.uid());
 END LOOP;
 -- Any exception rolls back the preparation, ALL deductions, and ALL events.
 RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.kitchen_reverse_preparation(p_preparation uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rec record; ev record;
BEGIN
 IF NOT public.has_role(auth.uid(), 'owner') THEN RAISE EXCEPTION 'Owner access required'; END IF;
 SELECT * INTO rec FROM public.kitchen_preparations WHERE id=p_preparation FOR UPDATE;
 IF NOT FOUND OR rec.reversed_at IS NOT NULL THEN RAISE EXCEPTION 'Preparation not found or already reversed'; END IF;
 -- Restore the immutable original deltas, never the current recipe definition.
 FOR ev IN SELECT ingredient_id,delta FROM public.kitchen_stock_events WHERE production_id=p_preparation AND reason='preparation' ORDER BY ingredient_id LOOP
 PERFORM 1 FROM public.pantry_ingredients WHERE id=ev.ingredient_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Ingredient not found'; END IF;
 UPDATE public.pantry_ingredients SET stock=stock-ev.delta WHERE id=ev.ingredient_id;
 INSERT INTO public.kitchen_stock_events(ingredient_id,delta,reason,production_id,actor_id)
 VALUES(ev.ingredient_id,-ev.delta,'reversal',p_preparation,auth.uid());
 END LOOP;
 UPDATE public.kitchen_preparations SET reversed_at=now() WHERE id=p_preparation;
END $$;
REVOKE ALL ON FUNCTION public.kitchen_change_stock(uuid,numeric,text), public.kitchen_prepare(uuid,numeric,date), public.kitchen_reverse_preparation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kitchen_change_stock(uuid,numeric,text), public.kitchen_prepare(uuid,numeric,date), public.kitchen_reverse_preparation(uuid) TO authenticated;
