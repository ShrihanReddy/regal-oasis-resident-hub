# Feature 2 — Dynamic property gallery

1. Apply `drizzle/migrations/0004_property_gallery.sql` to the same Supabase database used by the deployed site, **after** migration 0003. Use the Supabase SQL editor or normal migration tooling. Applying this migration is required before the gallery can load.
2. Owner permissions use the existing `public.has_role(user_id, 'owner')` function. Verify the real owner account is correctly assigned; do not remove role checks to make testing easier.
3. Start the project with `npm.cmd run dev`. Public gallery appears below the weekly food menu. Owner gallery controls appear under Owner Admin when logged in as the verified owner.
4. On localhost the existing Lovable-mediated Google OAuth route may fail (404). Test owner functions in a correctly configured authenticated staging environment before publishing. Local UI rendering alone does not prove uploads work.
5. Guest photos automatically appear on page refresh and within 30 seconds when revisiting after a data refresh. No new code or redeploy needed for future uploads.
6. All images are compressed client-side to 2000px maximum dimensions, WebP 82% quality. Storage bucket is public-read; owners-only write/delete and RLS-enforced database writes.
7. Verify upload, delete, caption, reorder, public display and mobile layout before promoting this branch.

**Note:** If an upload succeeded but metadata insertion failed, the code attempts to clean up the file. If a storage deletion succeeds but database deletion fails, metadata may briefly refer to a missing image. Review server/storage logs and retry after addressing any permission errors.
