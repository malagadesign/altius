import { createClient } from "@supabase/supabase-js";
import { hasDuplicateContact, loadContactIndex, sanitizeContact } from "./contact-utils.js";

function sendDuplicate(response) {
  response.status(409).json({
    code: "duplicate_contact",
    message: "Esta persona ya fue registrada con ese teléfono o email.",
  });
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const participantId = request.body?.participant_id;

  if (!supabaseUrl || !serviceRoleKey) {
    response.status(500).json({ error: "Environment is not configured" });
    return;
  }

  if (!participantId) {
    response.status(400).json({ error: "Missing participant" });
    return;
  }

  const contact = sanitizeContact(request.body);

  if (!contact.full_name || !contact.phone || !contact.email) {
    response.status(400).json({ error: "Missing required fields" });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const contacts = await loadContactIndex(supabase);

  if (hasDuplicateContact(contacts, contact)) {
    sendDuplicate(response);
    return;
  }

  const referral = {
    id: request.body?.id || crypto.randomUUID(),
    participant_id: participantId,
    ...contact,
  };

  const { data, error } = await supabase.from("referrals").insert(referral).select("*").single();

  if (error) {
    if (error.code === "23505" || error.message?.includes("duplicate_contact")) {
      sendDuplicate(response);
      return;
    }
    response.status(500).json({ error: "Could not create referral" });
    return;
  }

  response.status(200).json({ referral: data });
}
