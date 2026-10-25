-- Allow the owner to customize heading placement, size and colour.
ALTER TABLE public.homepage_settings
  ADD COLUMN heading_x integer NOT NULL DEFAULT 7 CHECK (heading_x BETWEEN 2 AND 65),
  ADD COLUMN heading_y integer NOT NULL DEFAULT 22 CHECK (heading_y BETWEEN 5 AND 75),
  ADD COLUMN heading_size integer NOT NULL DEFAULT 78 CHECK (heading_size BETWEEN 28 AND 110),
  ADD COLUMN heading_color text NOT NULL DEFAULT '#FFFFFF' CHECK (heading_color ~ '^#[0-9a-fA-F]{6}$');
-- Existing owner-only UPDATE and public SELECT policies also protect these columns.
