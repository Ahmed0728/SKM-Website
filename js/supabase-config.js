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
const STRIPE_PAYMENT_LINK = "";
