-- Resident Portal additions. Apply once to the existing live database; never replay 0002/0006/0007.
ALTER TABLE public.maintenance_tickets DROP CONSTRAINT IF EXISTS maintenance_tickets_category_check;
ALTER TABLE public.maintenance_tickets ADD CONSTRAINT maintenance_tickets_category_check CHECK (category IN ('Wi-Fi','Plumbing','Electrical','Cleaning','Food','Miscellaneous'));
ALTER TABLE public.maintenance_tickets ADD COLUMN IF NOT EXISTS allotment_id uuid REFERENCES public.student_allotments(id) ON DELETE SET NULL;
ALTER TABLE public.maintenance_tickets ADD COLUMN IF NOT EXISTS owner_reply text;
ALTER TABLE public.maintenance_tickets ADD COLUMN IF NOT EXISTS replied_at timestamptz;
ALTER TABLE public.anonymous_feedback ADD COLUMN IF NOT EXISTS tracking_hash text;
ALTER TABLE public.anonymous_feedback ADD COLUMN IF NOT EXISTS owner_reply text;
ALTER TABLE public.anonymous_feedback ADD COLUMN IF NOT EXISTS replied_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS anonymous_feedback_tracking_hash_idx ON public.anonymous_feedback(tracking_hash) WHERE tracking_hash IS NOT NULL;
-- The noticeboard is public but must not leak claimant identity or future private columns.
-- Browser clients have no direct public insert rights; resident submissions go through validated server handlers.
REVOKE INSERT, DELETE ON public.maintenance_tickets FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.anonymous_feedback FROM anon, authenticated;
GRANT UPDATE ON public.maintenance_tickets, public.anonymous_feedback TO authenticated;
DROP POLICY IF EXISTS owner_feedback_update ON public.anonymous_feedback;
CREATE POLICY owner_feedback_update ON public.anonymous_feedback FOR UPDATE TO authenticated
 USING (public.has_role(auth.uid(),'owner')) WITH CHECK (public.has_role(auth.uid(),'owner'));
-- NOTE: existing public SELECT on maintenance_tickets exposes any selected columns to raw API clients.
-- Restrict raw public SELECT and expose only a narrow, security-invoker-free public view.
DROP POLICY IF EXISTS public_ticket_board ON public.maintenance_tickets;
REVOKE SELECT ON public.maintenance_tickets FROM anon;
DROP VIEW IF EXISTS public.public_maintenance_board;
CREATE VIEW public.public_maintenance_board WITH (security_barrier=true) AS
 SELECT id, category, description, status, owner_reply, created_at, replied_at
 FROM public.maintenance_tickets;
REVOKE ALL ON public.public_maintenance_board FROM PUBLIC;
GRANT SELECT ON public.public_maintenance_board TO anon, authenticated;
-- Owner can still read full tickets through their authenticated owner-only RLS policy.
DROP POLICY IF EXISTS owner_tickets_read ON public.maintenance_tickets;
CREATE POLICY owner_tickets_read ON public.maintenance_tickets FOR SELECT TO authenticated
 USING (public.has_role(auth.uid(),'owner'));
