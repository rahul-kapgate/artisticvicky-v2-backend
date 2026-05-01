import { supabase } from "../config/supabaseClient.js";
import { sendDailyUsersReportEmail } from "../services/email.service.js";


export const sendDailyReport = async (req, res) => {
  try {
    // 🔐 optional security
    if (req.headers["x-cron-secret"] !== process.env.CRON_SECRET) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const now = new Date();

    const start = new Date();
    start.setDate(now.getDate() - 1);
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setDate(now.getDate() - 1);
    end.setHours(23, 59, 59, 999);

    // ✅ fetch users from Supabase
    const { data: users, error } = await supabase
      .from("users")
      .select("email, user_name,mobile, created_at")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString());

    if (error) throw error;

    // ✅ send email
    await sendDailyUsersReportEmail({ users });

    return res.json({
      success: true,
      count: users.length,
    });
  } catch (err) {
    console.error("Daily report error:", err);
    return res.status(500).json({ message: "Failed to send report" });
  }
};
