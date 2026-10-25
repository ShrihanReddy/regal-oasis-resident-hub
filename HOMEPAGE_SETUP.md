# Homepage Customization — Feature 3

1. Apply `drizzle/migrations/0005_homepage_background.sql` once in Lovable Cloud SQL editor (not twice). This changes the connected database. Check backups first.
2. Confirm `homepage_settings` has one row (`id = homepage`) and storage bucket `homepage-backgrounds` exists.
3. Push code to `development`, select that branch in Lovable preview, and log into Owner Admin with verified owner credentials.
4. Choose a hero image, reposition, Save, refresh Guest View, test Reset to Default and Restore Previous. Try mobile.
5. Do not publish to `main` until verified. Uploaded images remain in storage for undo; old images can be manually cleaned up later.

The default bundled image is used until the new settings row loads. Failed database fetches also fall back to the bundled image.
