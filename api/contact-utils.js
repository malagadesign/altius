export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function normalizePhone(value) {
  const clean = String(value || "").replace(/[^\d+]/g, "").trim();
  const digits = clean.replace(/\D/g, "");

  if (!digits) return "+56";
  if (digits.startsWith("56")) return `+${digits}`;
  if (digits.startsWith("0")) return `+56${digits.slice(1)}`;
  return `+56${digits}`;
}

export function sanitizeContact(payload) {
  return {
    full_name: String(payload?.full_name || "").trim().replace(/\s+/g, " "),
    phone: normalizePhone(payload?.phone),
    email: normalizeEmail(payload?.email),
  };
}

export function hasDuplicateContact(contacts, payload) {
  const targetPhone = normalizePhone(payload.phone);
  const targetEmail = normalizeEmail(payload.email);

  return contacts.some((contact) => {
    return (
      normalizePhone(contact.phone) === targetPhone ||
      normalizeEmail(contact.email) === targetEmail
    );
  });
}

export async function loadContactIndex(supabase) {
  const [{ data: participants, error: participantsError }, { data: referrals, error: referralsError }] =
    await Promise.all([
      supabase.from("participants").select("full_name, phone, email"),
      supabase.from("referrals").select("full_name, phone, email"),
    ]);

  if (participantsError || referralsError) {
    throw new Error("Could not validate duplicates");
  }

  return [...(participants || []), ...(referrals || [])];
}
