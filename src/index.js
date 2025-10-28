import dotenv from "dotenv";
import app from "./app.js";
import { supabase } from "./config/supabaseClient.js";

dotenv.config();
const PORT = process.env.PORT || 5000;

// Connect to DB 
supabase;

app.get("/", (req, res) => {
  console.log("✅ Home route accessed for v2");
  res.send("HOME ROUTE Aartisticvicky v2");
});


// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running is on port ${PORT}`);
});
