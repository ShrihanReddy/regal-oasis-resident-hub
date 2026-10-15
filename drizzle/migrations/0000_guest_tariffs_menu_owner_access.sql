CREATE TYPE public.app_role AS ENUM ('owner');
CREATE TABLE public.user_roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, role public.app_role NOT NULL, UNIQUE(user_id, role));
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY read_own_role ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles r JOIN auth.users u ON u.id = r.user_id WHERE r.user_id = _user_id AND r.role = _role AND u.email_confirmed_at IS NOT NULL AND lower(u.email) = 'workwithshrihan08@gmail.com'); $$;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
CREATE FUNCTION public.assign_verified_owner() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN IF lower(NEW.email) = 'workwithshrihan08@gmail.com' AND NEW.email_confirmed_at IS NOT NULL THEN INSERT INTO public.user_roles(user_id, role) VALUES(NEW.id, 'owner') ON CONFLICT (user_id, role) DO NOTHING; END IF; RETURN NEW; END; $$;
REVOKE ALL ON FUNCTION public.assign_verified_owner() FROM PUBLIC;
CREATE TRIGGER assign_verified_owner AFTER INSERT OR UPDATE OF email, email_confirmed_at ON auth.users FOR EACH ROW EXECUTE FUNCTION public.assign_verified_owner();
CREATE TABLE public.accommodations (id text PRIMARY KEY, title text NOT NULL, rent integer NOT NULL CHECK (rent > 0 AND rent <= 1000000), sort_order integer NOT NULL);
GRANT SELECT ON public.accommodations TO anon, authenticated;
GRANT UPDATE ON public.accommodations TO authenticated;
GRANT ALL ON public.accommodations TO service_role;
ALTER TABLE public.accommodations ENABLE ROW LEVEL SECURITY;
CREATE POLICY public_tariffs ON public.accommodations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY owner_update_tariffs ON public.accommodations FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'owner')) WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE TABLE public.mess_menu (id text PRIMARY KEY, day text NOT NULL CHECK(day IN ('mon','tue','wed')), meal text NOT NULL CHECK(meal IN ('Breakfast','Lunch','Evening Snacks','Dinner')), items text NOT NULL CHECK(length(items) BETWEEN 1 AND 1000), sort_order integer NOT NULL, UNIQUE(day, meal));
GRANT SELECT ON public.mess_menu TO anon, authenticated;
GRANT UPDATE ON public.mess_menu TO authenticated;
GRANT ALL ON public.mess_menu TO service_role;
ALTER TABLE public.mess_menu ENABLE ROW LEVEL SECURITY;
CREATE POLICY public_menu ON public.mess_menu FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY owner_update_menu ON public.mess_menu FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'owner')) WITH CHECK (public.has_role(auth.uid(), 'owner'));
INSERT INTO public.accommodations(id,title,rent,sort_order) VALUES ('three-non-ac','3-Sharing Non-AC',9000,1),('three-ac','3-Sharing AC',10000,2),('two-sharing','2-Sharing',9000,3);
INSERT INTO public.mess_menu(id,day,meal,items,sort_order) VALUES
('mon-breakfast','mon','Breakfast','Idli, sambar, coconut chutney, tea',1),('mon-lunch','mon','Lunch','Rice, dal, seasonal vegetables, curd',2),('mon-snacks','mon','Evening Snacks','Samosa, tea',3),('mon-dinner','mon','Dinner','Chapati, paneer curry, rice, dal',4),
('tue-breakfast','tue','Breakfast','Poha, banana, tea',1),('tue-lunch','tue','Lunch','Rice, rajma, vegetable sabzi, curd',2),('tue-snacks','tue','Evening Snacks','Pakora, tea',3),('tue-dinner','tue','Dinner','Chapati, mixed vegetable curry, dal',4),
('wed-breakfast','wed','Breakfast','Dosa, sambar, chutney, tea',1),('wed-lunch','wed','Lunch','Vegetable biryani, raita, salad',2),('wed-snacks','wed','Evening Snacks','Pav bhaji, tea',3),('wed-dinner','wed','Dinner','Chapati, paneer butter masala, rice, dessert',4);