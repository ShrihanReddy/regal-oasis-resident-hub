 IF NOT public.has_role(auth.uid(),'owner') THEN RAISE EXCEPTION 'Owner access required'; END IF;
 IF p_quantity IS NULL OR p_quantity <= 0 OR p_quantity > 100000 OR p_date IS NULL THEN RAISE EXCEPTION 'Invalid preparation quantity/date'; END IF;
 SELECT * INTO rec FROM public.kitchen_recipes WHERE id=p_recipe FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Recipe not found'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.kitchen_recipe_ingredients WHERE recipe_id=p_recipe) THEN RAISE EXCEPTION 'Recipe has no ingredients'; END IF;
 -- Lock the recipe composition while calculating and recording this batch.
 PERFORM 1 FROM public.kitchen_recipe_ingredients WHERE recipe_id=p_recipe ORDER BY ingredient_id FOR SHARE;
 -- Lock ingredient rows in a stable order; fail entire transaction if any stock insufficient.
 FOR ingredient IN SELECT i.id,i.stock,ri.quantity FROM public.kitchen_recipe_ingredients ri
 JOIN public.pantry_ingredients i ON i.id=ri.ingredient_id WHERE ri.recipe_id=p_recipe ORDER BY i.id FOR UPDATE OF i LOOP
 needed := round(ingredient.quantity*p_quantity/rec.base_yield,3);
 IF needed <= 0 OR ingredient.stock < needed THEN RAISE EXCEPTION 'Insufficient stock for ingredient %', ingredient.id; END IF;
 END LOOP;
 INSERT INTO public.kitchen_preparations(recipe_id,recipe_name,quantity,unit,prepared_on,actor_id)
 VALUES(rec.id,rec.name,p_quantity,rec.yield_unit,p_date,auth.uid()) RETURNING id INTO new_id;
 FOR ingredient IN SELECT i.id,ri.quantity FROM public.kitchen_recipe_ingredients ri
 JOIN public.pantry_ingredients i ON i.id=ri.ingredient_id WHERE ri.recipe_id=p_recipe ORDER BY i.id LOOP
 needed := round(ingredient.quantity*p_quantity/rec.base_yield,3);
 UPDATE public.pantry_ingredients SET stock=stock-needed WHERE id=ingredient.id;
 INSERT INTO public.kitchen_stock_events(ingredient_id,delta,reason,production_id,actor_id)
 VALUES(ingredient.id,-needed,'preparation',new_id,auth.uid());
 END LOOP;
 RETURN new_id;
END $$;
CREATE OR REPLACE FUNCTION public.kitchen_reverse_preparation(p_preparation uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public, pg_temp AS $$
DECLARE rec record; ev record;
BEGIN
 IF NOT public.has_role(auth.uid(),'owner') THEN RAISE EXCEPTION 'Owner access required'; END IF;
 SELECT * INTO rec FROM public.kitchen_preparations WHERE id=p_preparation FOR UPDATE;
 IF NOT FOUND OR rec.reversed_at IS NOT NULL THEN RAISE EXCEPTION 'Preparation not found or already reversed'; END IF;
 FOR ev IN SELECT ingredient_id,delta FROM public.kitchen_stock_events WHERE production_id=p_preparation AND reason='preparation' ORDER BY ingredient_id LOOP
 UPDATE public.pantry_ingredients SET stock=stock-ev.delta WHERE id=ev.ingredient_id;
 INSERT INTO public.kitchen_stock_events(ingredient_id,delta,reason,production_id,actor_id) VALUES(ev.ingredient_id,-ev.delta,'reversal',p_preparation,auth.uid());
 END LOOP;
 UPDATE public.kitchen_preparations SET reversed_at=now() WHERE id=p_preparation;
END $$;
REVOKE ALL ON FUNCTION public.kitchen_change_stock(uuid,numeric,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.kitchen_prepare(uuid,numeric,date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.kitchen_reverse_preparation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kitchen_change_stock(uuid,numeric,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kitchen_prepare(uuid,numeric,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kitchen_reverse_preparation(uuid) TO authenticated;
