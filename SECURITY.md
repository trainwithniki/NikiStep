# Security

Never commit database passwords, Supabase secret/service-role keys, real participant exports, or backups.

Administrator access is controlled by Supabase Auth plus the `app_admins` allow-list and Row Level Security policies. A link to `admin.html` is navigation, not authorization.
