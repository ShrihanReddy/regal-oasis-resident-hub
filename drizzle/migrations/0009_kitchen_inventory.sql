-- Feature 6: inventory and recipe-controlled kitchen production.
-- Execute once after checking for existing objects. All mutations require owner role.
CREATE TABLE public.pantry_ingredients (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE CHECK (char_length(trim(name)) BETWEEN 1 AND 100),
 unit text NOT NULL CHECK (unit IN ('g','ml','pieces')),
 stock numeric(14,3) NOT NULL DEFAULT 0 CHECK (stock >= 0),
 low_stock numeric(14,3) NOT NULL DEFAULT 0 CHECK (low_stock >= 0),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.kitchen_recipes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE CHECK (char_length(trim(name)) BETWEEN 1 AND 100),
 yield_unit text NOT NULL CHECK (yield_unit IN ('kg','L','pieces')),
 base_yield numeric(12,3) NOT NULL CHECK (base_yield > 0),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.kitchen_recipe_ingredients (
 recipe_id uuid NOT NULL REFERENCES public.kitchen_recipes(id) ON DELETE CASCADE,
 ingredient_id uuid NOT NULL REFERENCES public.pantry_ingredients(id) ON DELETE RESTRICT,
 quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
 PRIMARY KEY(recipe_id,ingredient_id)
);
CREATE TABLE public.kitchen_stock_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ingredient_id uuid NOT NULL REFERENCES public.pantry_ingredients(id),
 delta numeric(14,3) NOT NULL CHECK (delta <> 0),
 reason text NOT NULL CHECK (reason IN ('restock','adjustment','preparation','reversal')),
 production_id uuid, created_at timestamptz NOT NULL DEFAULT now(), actor_id uuid
);
CREATE TABLE public.kitchen_preparations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), recipe_id uuid NOT NULL REFERENCES public.kitchen_recipes(id),
 recipe_name text NOT NULL, quantity numeric(12,3) NOT NULL CHECK (quantity > 0), unit text NOT NULL,
 prepared_on date NOT NULL DEFAULT current_date, reversed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), actor_id uuid
);
ALTER TABLE public.kitchen_stock_events ADD CONSTRAINT kitchen_stock_event_preparation_fk FOREIGN KEY (production_id) REFERENCES public.kitchen_preparations(id);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['pantry_ingredients','kitchen_recipes','kitchen_recipe_ingredients','kitchen_stock_events','kitchen_preparations'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
 EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
 EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.has_role(auth.uid(),''owner'')) WITH CHECK (public.has_role(auth.uid(),''owner''))', t||'_owner_only', t);
 END LOOP;
END $$;
-- Atomic stock modification, with row locks to prevent concurrent double spending.
CREATE OR REPLACE FUNCTION public.kitchen_change_stock(p_ingredient uuid, p_delta numeric, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE current_stock numeric;
BEGIN
 IF NOT public.has_role(auth.uid(),'owner') THEN RAISE EXCEPTION 'Owner access required'; END IF;
 IF p_delta = 0 OR p_reason NOT IN ('restock','adjustment') THEN RAISE EXCEPTION 'Invalid stock change'; END IF;
 SELECT stock INTO current_stock FROM public.pantry_ingredients WHERE id=p_ingredient FOR UPDATE;
 IF NOT FOUND OR current_stock + p_delta < 0 THEN RAISE EXCEPTION 'Insufficient stock or missing ingredient'; END IF;
 UPDATE public.pantry_ingredients SET stock = stock+p_delta WHERE id=p_ingredient;
 INSERT INTO public.kitchen_stock_events(ingredient_id,delta,reason,actor_id) VALUES(p_ingredient,p_delta,p_reason,auth.uid());
END $$;
CREATE OR REPLACE FUNCTION public.kitchen_prepare(p_recipe uuid,p_quantity numeric,p_date date DEFAULT current_date)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE rec record; ingredient record; new_id uuid; needed numeric;
BEGIN
 IF NOT public.has_role(auth.uid(),'owner') THEN RAISE EXCEPTION 'Owner access required'; END IF;
 IF p_quantity IS NULL OR p_quantity <= 0 OR p_quantity > 100000 OR p_date IS NULL THEN RAISE EXCEPTION 'Invalid preparation quantity/date'; END IF;
 SELECT * INTO rec FROM public.kitchen_recipes WHERE id=p_recipe;
 IF NOT FOUND THEN RAISE EXCEPTION 'Recipe not found'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.kitchen_recipe_ingredients WHERE recipe_id=p_recipe) THEN RAISE EXCEPTION 'Recipe has no ingredients'; END IF;
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
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
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
