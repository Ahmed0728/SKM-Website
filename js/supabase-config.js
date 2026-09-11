// Fill these in from your Supabase project settings (Project Settings > API).
// The anon/public key is safe to expose in client-side code — access is
// controlled by the Row Level Security policies set up on the `members` table
// (see README.md).
const SUPABASE_URL = "https://czrpeyzeutigwaavmpct.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_qPwgr6TK8lny4KGc5L6C_w_aGSgH4iL";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Stripe Payment Link for the $35/month membership fee (Stripe Dashboard >
// Payment links). Safe to be public — it's just a URL, no secret key
// involved. See README.md for setup steps.
//
// NOTE: this is currently a TEST-mode link (Stripe account not yet
// verified for live payments — see README "3b. Payment"). It works
// end-to-end with Stripe's test cards but won't charge anyone for real.
// Once the account is verified, swap this for the live-mode link.
const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/test_3cI6oJctI4SY6ok1NE4ko00";
