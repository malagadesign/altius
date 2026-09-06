import { createClient } from "@supabase/supabase-js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const token = String(request.query?.token || "");
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!token) {
    response.status(400).json({ error: "Missing token" });
    return;
  }

  if (!supabaseUrl || !serviceRoleKey) {
    response.status(500).json({ error: "Environment is not configured" });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await supabase.rpc("get_participant_dashboard", {
    token_input: token,
  });

  if (error || !data?.participant) {
    response.status(404).json({ error: "Participant not found" });
    return;
  }

  response.status(200).json(data);
}
