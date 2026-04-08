import dotenv from "dotenv";
import app from "./app.js";
import { supabase } from "./config/supabaseClient.js";

dotenv.config();
const PORT = process.env.PORT;

// Connect to DB 
supabase;

app.get("/", (req, res) => {
  console.log("✅ Home route accessed for v2");
  res.send("HOME ROUTE Aartisticvicky v2");
});


// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
