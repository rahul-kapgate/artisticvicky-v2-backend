import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Create Supabase client 
export const supabase = createClient(supabaseUrl, supabaseKey);

// test connection
(async () => {
  try {
    const { data, error } = await supabase.from("users").select("*").limit(1);
    if (error) throw error;
    console.log("✅ Supabase Connected Successfully");
  } catch (err) {
    console.error("❌ Supabase Connection Error:", err.message);
  }
})();
