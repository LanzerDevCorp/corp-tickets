"use server";

import { getAppRoleFromClaims } from "@/lib/auth/claims";
import {
  isPendingStaffInvite,
  isStaffRole,
  staffInviteRedirectUrl,
} from "@/lib/auth/staff-invite";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Role } from "@/lib/auth/roles";
import { categoryUpsertSchema } from "@/lib/schemas/category-upsert";
import type { User } from "@supabase/supabase-js";

export type AdminActionResult<T = undefined> =
  | { error: null; data: T }
  | { error: string; code?: "validation" | "db" | "auth" };

export type UserRow = {
  id: string;
  role: "admin" | "it" | "client";
  email: string;
  display_name: string | null;
  is_active: boolean;
  is_pending_invite: boolean;
  created_at: string;
};

export type CategoryRow = {
  id: string;
  name: string;
  is_enabled: boolean;
  created_at: string;
};

async function requireAdmin(): Promise<
  AdminActionResult<{ role: Role; sub: string }>
> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const role = getAppRoleFromClaims(claimsData?.claims);
  const sub = claimsData?.claims?.sub as string | undefined;
  if (role !== "admin") {
    return { error: "No autorizado", code: "auth" };
  }
  return { error: null, data: { role, sub: sub ?? "" } };
}

async function fetchAuthUsersById(): Promise<Map<string, User>> {
  const authUsers = new Map<string, User>();
  let page = 1;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      throw new Error(error.message);
    }

    for (const user of data.users) {
      authUsers.set(user.id, user);
    }

    if (data.users.length < 1000) {
      break;
    }

    page += 1;
  }

  return authUsers;
}

async function getStaffUserOrError(
  userId: string,
): Promise<
  AdminActionResult<{ id: string; email: string; role: "admin" | "it" }>
> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, email, role")
    .eq("id", userId)
    .single();

  if (error) {
    return { error: error.message, code: "db" };
  }

  if (!isStaffRole(data.role as Role)) {
    return { error: "El usuario no es personal", code: "validation" };
  }

  return {
    error: null,
    data: { id: data.id, email: data.email, role: data.role },
  };
}

export async function getUsers(): Promise<AdminActionResult<UserRow[]>> {
  const authResult = await requireAdmin();
  if (authResult.error !== null) return authResult;

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, email, display_name, role, is_active, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return { error: error.message, code: "db" };
  }

  let authUsers: Map<string, User>;
  try {
    authUsers = await fetchAuthUsersById();
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "No se pudieron cargar los usuarios de autenticación",
      code: "db",
    };
  }

  const rows = (data ?? []).map((user) => {
    const role = user.role as UserRow["role"];
    return {
      ...(user as Omit<UserRow, "is_pending_invite">),
      role,
      is_pending_invite: isPendingStaffInvite(authUsers.get(user.id), role),
    };
  });

  return { error: null, data: rows };
}

export async function reinviteStaffUser(
  userId: string,
): Promise<AdminActionResult> {
  const authResult = await requireAdmin();
  if (authResult.error !== null) return authResult;

  const userResult = await getStaffUserOrError(userId);
  if (userResult.error !== null) return userResult;

  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.getUserById(userId);

  if (authError) {
    return { error: authError.message, code: "db" };
  }

  if (!isPendingStaffInvite(authData.user, userResult.data.role)) {
    return {
      error: "El usuario no tiene una invitación pendiente",
      code: "validation",
    };
  }

  const redirectTo = staffInviteRedirectUrl();
  const { error: inviteError } =
    await supabaseAdmin.auth.admin.inviteUserByEmail(userResult.data.email, {
      redirectTo,
    });

  if (inviteError) {
    return { error: inviteError.message, code: "db" };
  }

  const { error: metaError } = await supabaseAdmin.auth.admin.updateUserById(
    userId,
    { app_metadata: { role: userResult.data.role } },
  );

  if (metaError) {
    return { error: metaError.message, code: "db" };
  }

  const { error: roleError } = await supabaseAdmin
    .from("users")
    .update({ role: userResult.data.role })
    .eq("id", userId);

  if (roleError) {
    return { error: roleError.message, code: "db" };
  }

  return { error: null, data: undefined };
}

export async function cancelStaffInvite(
  userId: string,
): Promise<AdminActionResult> {
  const authResult = await requireAdmin();
  if (authResult.error !== null) return authResult;

  const userResult = await getStaffUserOrError(userId);
  if (userResult.error !== null) return userResult;

  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.getUserById(userId);

  if (authError) {
    return { error: authError.message, code: "db" };
  }

  if (!isPendingStaffInvite(authData.user, userResult.data.role)) {
    return {
      error: "El usuario no tiene una invitación pendiente",
      code: "validation",
    };
  }

  const { error: deleteError } =
    await supabaseAdmin.auth.admin.deleteUser(userId);

  if (deleteError) {
    return { error: deleteError.message, code: "db" };
  }

  return { error: null, data: undefined };
}

export async function deactivateUser(
  userId: string,
): Promise<AdminActionResult> {
  const authResult = await requireAdmin();
  if (authResult.error !== null) return authResult;
  const { sub } = authResult.data;

  if (userId === sub) {
    return { error: "No puedes desactivar tu propia cuenta", code: "auth" };
  }

  const { data: _data, error } = await supabaseAdmin
    .from("users")
    .update({ is_active: false })
    .eq("id", userId)
    .select("id")
    .single();

  if (error) {
    return { error: error.message, code: "db" };
  }

  return { error: null, data: undefined };
}

export async function reactivateUser(
  userId: string,
): Promise<AdminActionResult> {
  const authResult = await requireAdmin();
  if (authResult.error !== null) return authResult;

  const { data: _data, error } = await supabaseAdmin
    .from("users")
    .update({ is_active: true })
    .eq("id", userId)
    .select("id")
    .single();

  if (error) {
    return { error: error.message, code: "db" };
  }

  return { error: null, data: undefined };
}

export async function getCategories(): Promise<
  AdminActionResult<CategoryRow[]>
> {
  const authResult = await requireAdmin();
  if (authResult.error !== null) return authResult;

  const { data, error } = await supabaseAdmin
    .from("categories")
    .select("id, name, is_enabled, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return { error: error.message, code: "db" };
  }

  return { error: null, data: (data ?? []) as CategoryRow[] };
}

export async function createCategory(input: {
  name: string;
}): Promise<AdminActionResult<CategoryRow>> {
  const authResult = await requireAdmin();
  if (authResult.error !== null) return authResult;

  const parsed = categoryUpsertSchema.pick({ name: true }).safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
      code: "validation",
    };
  }

  const { data, error } = await supabaseAdmin
    .from("categories")
    .insert({ name: parsed.data.name, is_enabled: true })
    .select("id, name, is_enabled, created_at")
    .single();

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return {
        error: "Ya existe una categoría con este nombre.",
        code: "db",
      };
    }
    return { error: error.message, code: "db" };
  }

  return { error: null, data: data as CategoryRow };
}

export async function updateCategory(
  categoryId: string,
  input: { name?: string; is_enabled?: boolean },
): Promise<AdminActionResult<CategoryRow>> {
  const authResult = await requireAdmin();
  if (authResult.error !== null) return authResult;

  if (input.name !== undefined) {
    const parsed = categoryUpsertSchema
      .pick({ name: true })
      .safeParse({ name: input.name });
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message ?? "Datos inválidos",
        code: "validation",
      };
    }
  }

  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) payload.name = input.name;
  if (input.is_enabled !== undefined) payload.is_enabled = input.is_enabled;

  const { data, error } = await supabaseAdmin
    .from("categories")
    .update(payload)
    .eq("id", categoryId)
    .select("id, name, is_enabled, created_at")
    .single();

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return {
        error: "Ya existe una categoría con este nombre.",
        code: "db",
      };
    }
    return { error: error.message, code: "db" };
  }

  return { error: null, data: data as CategoryRow };
}
