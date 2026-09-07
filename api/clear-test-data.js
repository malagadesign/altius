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
  const resetEnabled = process.env.ALLOW_TEST_DATA_RESET === "true";

  if (!adminPassword || !supabaseUrl || !serviceRoleKey) {
    response.status(500).json({ error: "Admin environment is not configured" });
    return;
  }

  if (!resetEnabled) {
    response.status(403).json({
      code: "reset_disabled",
      error: "Test data reset is disabled",
    });
    return;
  }

  const body = request.body || {};
  if (body.username !== adminUsername || body.password !== adminPassword) {
    response.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (body.confirmation !== "ELIMINAR PRUEBAS") {
    response.status(400).json({ error: "Missing confirmation" });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { error: referralsError } = await supabase.from("referrals").delete().not("id", "is", null);
  if (referralsError) {
    response.status(500).json({ error: "Could not clear referrals" });
    return;
  }

  const { error: participantsError } = await supabase
    .from("participants")
    .delete()
    .not("id", "is", null);
  if (participantsError) {
    response.status(500).json({ error: "Could not clear participants" });
    return;
  }

  response.status(200).json({ participants: [], referrals: [] });
}
