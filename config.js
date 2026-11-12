
window.SUPABASE_URL = "https://lfzogzwjrqqoojyqrnrk.supabase.co";

window.SUPABASE_ANON_KEY = "sb_publishable_aS1a7TWj7WbpUlR7t0tUTg_1psJ1-iK";

if (
  window.supabase &&
  window.SUPABASE_URL &&
  window.SUPABASE_ANON_KEY
) {
  window.supabaseClient = window.supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_ANON_KEY
  );
} else {
  console.error("Supabase connection could not be initialized.");
}
