import { createClient } from "@supabase/supabase-js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminUsername = process.env.ADMIN_USERNAME || "admin";
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!adminPassword || !supabaseUrl || !serviceRoleKey) {
    response.status(500).json({
      code: "admin_not_configured",
      error: "Admin environment is not configured",
    });
    return;
  }

  const body = request.body || {};
  if (body.username !== adminUsername || body.password !== adminPassword) {
    response.status(401).json({ code: "invalid_credentials", error: "Unauthorized" });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const [{ data: participants, error: participantsError }, { data: referrals, error: referralsError }] =
    await Promise.all([
      supabase.from("participants").select("*").order("created_at", { ascending: false }),
      supabase.from("referrals").select("*").order("created_at", { ascending: false }),
    ]);

  if (participantsError || referralsError) {
    response.status(500).json({ code: "admin_data_error", error: "Could not load entries" });
    return;
  }

  response.status(200).json({ participants, referrals });
}
