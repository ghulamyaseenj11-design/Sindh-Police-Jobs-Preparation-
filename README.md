# Sindh Jail Police

Preparation, Notes and Latest Updates.

## Website Features

- Responsive home page
- Navy blue and gold design
- Preparation categories
- Announcement section
- Admin login
- Admin announcement publishing
- Supabase database connection

## Files

- index.html
- admin.html
- styles.css
- config.js
- app.js
- admin.js
- README.md

## Supabase Setup

1. Create a Supabase project.
2. Add your Project URL to config.js.
3. Add your anon/public key to config.js.
4. Never expose your service_role key.
5. Ensure the announcements table has these columns:
   - title
   - content
   - is_active
   - created_at
6. Ensure the is_admin() database function and admin RLS policies are configured.

## Admin Panel

Open admin.html to access the admin login.

Only authorized administrator accounts should be allowed to publish announcements.

## Disclaimer

This is a preparation and information website. It is not the official website of Sindh Prisons and Corrections Service. Always check official notices on the official department and testing service websites.