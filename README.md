# NifferFashionHouz (React + Supabase)

Shop with Google sign-in, Paystack payment, order storage in Supabase, and Mailgun confirmation emails.

## 1. Supabase
1. Run `schema.sql` in the SQL Editor (tables, security rules, sample products).
2. Copy `.env.example` to `.env`; fill in the Project URL and publishable key.

## 2. Google sign-in
1. Google Cloud Console: create a project, then **APIs & Services > OAuth consent screen** (External), then **Credentials > Create OAuth client ID > Web application**.
2. Authorized redirect URI: `https://YOUR-PROJECT.supabase.co/auth/v1/callback`.
3. Supabase: **Authentication > Providers > Google**, paste the Client ID and Secret, enable.
4. Supabase: **Authentication > URL Configuration**: set Site URL to your Vercel URL and add `http://localhost:5173` as a redirect URL.

## 3. Paystack (payments, NGN)
Create a Paystack account, copy the test public key into `VITE_PAYSTACK_PUBLIC_KEY`.

## 4. Mailgun + the confirm-order function
1. Create a Mailgun account and note your API key and sending domain. (Sandbox domains only email addresses you add as authorized recipients.)
2. Install the Supabase CLI, then:
   ```bash
   supabase login
   supabase link --project-ref YOUR-PROJECT-REF
   supabase secrets set PAYSTACK_SECRET_KEY=sk_test_xxx MAILGUN_API_KEY=xxx MAILGUN_DOMAIN=mg.yourdomain.com
   supabase functions deploy confirm-order
   ```
   Secret keys live only in Supabase secrets, never in the frontend.

## 5. Run
`npm install` then `npm run dev`. On Vercel add the three `VITE_` variables, then redeploy.

## Adding product photos
Set `image_url` on rows in the `products` table (Supabase Table Editor), using any image URL or Supabase Storage public URL.

