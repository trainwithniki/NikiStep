# NikiStep

Step Aerobics / With Niki booking site with a protected administration page and Supabase realtime synchronization.

## Pages

- `index.html` — public schedule and booking page
- `admin.html` — protected administration page
- **Powered by Niki** at the bottom links to the administration page

Both pages use the same Supabase database. Changes and new registrations arrive through Supabase Realtime without refreshing the browser.

## Android administration application

The protected administration page is an installable Progressive Web App. On an Android phone:

1. Open `admin.html` from the published site in Google Chrome.
2. Tap **Инсталирай** in the **Niki Admin** banner. If the banner says **Как?**, tap it for the manual installation steps.
3. Confirm the installation. **Niki Admin** then appears on the Home screen and in the app launcher.

The installed app starts directly at the protected administration login. The public booking page never shows the **Niki Admin** installation banner.

The public booking page also has its own **Step с Niki** application. Its inline installation card appears below the featured training and before the MultiSport information when the training date scrolls into view. After a successful installation, the card stays hidden on that device.

## iPhone and iPad application

The public **Step с Niki** application can be added from both Safari and Google Chrome on iOS/iPadOS 16.4 or newer. Open the Share menu, choose **Add to Home Screen**, and confirm with **Add**. The site detects iOS and shows these instructions instead of the Android prompt.

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

### Updating an existing Supabase project

Run new files from `supabase/migrations/` in date order through **Supabase → SQL Editor**. For the admin-only external-training payment records, run:

`supabase/migrations/20260821_add_manual_payment_sessions.sql`

For the four editable external-training templates and the 8/12-visit card payment types, then run:

`supabase/migrations/20260822_add_payment_templates_and_visit_cards.sql`

For the 8-visit and 12-visit card counters on platform trainings, also run:

`supabase/migrations/20260822_add_visit_card_payment_adjustments.sql`

To show the anonymous public-app installation counter in the admin panel, run:

`supabase/migrations/20260822_add_app_installations.sql`

To include iPhone and iPad installations in the same counter, then run:

`supabase/migrations/20260822_add_ios_app_installations.sql`

The tables are protected by Row Level Security and are not readable from the public booking page. The installation counter stores only a random installation identifier, platform, and installation time—no name, phone number, IP address, or browser details.

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
