# NikiStep

Step Aerobics / With Niki booking site with a protected administration page and Supabase realtime synchronization.

## Pages

- `index.html` — public schedule and booking page
- `admin.html` — protected administration page
- **Powered by Niki** at the bottom links to the administration page

Both pages use the same Supabase database. Changes and new registrations arrive through Supabase Realtime without refreshing the browser.

## First-time Supabase setup

1. Open the Supabase project.
2. Go to **SQL Editor → New query**.
3. Paste the complete contents of `supabase/schema.sql` and press **Run**.
4. Go to **Authentication → Users → Add user** and create the administrator with an email and a strong password.
5. Return to SQL Editor and run the final commented admin command from `schema.sql`, replacing `your-email@example.com` with that same email:

   ```sql
   insert into public.app_admins(user_id)
   select id from auth.users where email = 'your-real-email@example.com'
   on conflict do nothing;
   ```

6. In **Authentication → URL Configuration**, add the final website URL to **Site URL** and **Redirect URLs**.

Never put a Supabase secret key or `service_role` key in this repository. The publishable key in `config.js` is designed for browser use; database access is protected by Row Level Security.

## Local preview

Do not open the files directly with `file://`. Start any local static server, for example:

```bash
python -m http.server 8080
```

Then open:

- `http://localhost:8080/`
- `http://localhost:8080/admin.html`

## Deployment

The project is static and can be deployed through GitHub Pages, Cloudflare Pages, Netlify or Vercel. Supabase provides the database, authentication and realtime connection.

For GitHub Pages:

1. Open the repository on GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select branch `main`, folder `/ (root)`, and save.
5. Add the resulting Pages URL to Supabase Authentication URL Configuration.

## Security and privacy

- Public visitors can read the schedule and create a booking only while booking is open.
- Public visitors receive only registration counts, never participant names or phone numbers.
- Only users listed in `app_admins` can view participant details or edit sessions.
- The original browser-side password hashes and sample personal details were removed.
