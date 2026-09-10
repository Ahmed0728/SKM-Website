// Fill these in from your Supabase project settings (Project Settings > API).
// The anon/public key is safe to expose in client-side code — access is
// controlled by the Row Level Security policies set up on the `members` table
// (see README.md).
const SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
const SUPABASE_ANON_KEY = "YOUR-ANON-PUBLIC-KEY";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
