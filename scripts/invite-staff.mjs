/**
 * Bootstrap staff accounts in Supabase Auth (prod or local).
 *
 * Usage:
 *   node --env-file=.env scripts/invite-staff.mjs <email> [admin|it] [--delete-if-exists]
 *
 * Examples:
 *   node --env-file=.env scripts/invite-staff.mjs admin@corp.com admin
 *   node --env-file=.env scripts/invite-staff.mjs it@corp.com it --delete-if-exists
 *
 * Requires:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   NEXT_PUBLIC_SITE_URL  (used for invite redirect → /auth/accept-invite)
 *
 * The invitee receives a Supabase email. After accepting, they set a password
 * and can log in at /auth/login.
 */

import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith("--")));

const email = args[0] ?? process.env.INVITE_EMAIL;
const role = args[1] ?? "admin";
const deleteIfExists = flags.has("--delete-if-exists");

if (!email) {
  console.error(
    "Usage: node --env-file=.env scripts/invite-staff.mjs <email> [admin|it] [--delete-if-exists]"
  );
  process.exit(1);
}

if (role !== "admin" && role !== "it") {
  console.error('Role must be "admin" or "it".');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

if (!siteUrl) {
  console.error(
    "Missing NEXT_PUBLIC_SITE_URL. Set it to your app URL (e.g. https://corp-tickets.vercel.app)."
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail(targetEmail) {
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const match = data.users.find(
      (u) => u.email?.toLowerCase() === targetEmail.toLowerCase()
    );
    if (match) return match;
    if (data.users.length < 1000) return null;
    page += 1;
  }
}

async function main() {
  const existing = await findUserByEmail(email);

  if (existing) {
    if (!deleteIfExists) {
      console.error(
        `User ${email} already exists (id: ${existing.id}).\n` +
          "Delete them in Supabase Dashboard or pass --delete-if-exists."
      );
      process.exit(1);
    }
    const { error } = await admin.auth.admin.deleteUser(existing.id);
    if (error) throw error;
    console.log(`Deleted existing user ${existing.id}`);
  }

  const redirectTo = `${siteUrl}/auth/accept-invite`;

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
  });
  if (error) throw error;

  const { error: metaError } = await admin.auth.admin.updateUserById(data.user.id, {
    app_metadata: { role },
  });
  if (metaError) throw metaError;

  console.log(`Invitation sent to ${email} with role "${role}".`);
  console.log(`User id: ${data.user.id}`);
  console.log(`After accepting, redirect: ${redirectTo}`);
  console.log("Check the inbox (and spam) for the Supabase invite email.");
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
