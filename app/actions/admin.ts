"use server";

import { getAppRoleFromClaims } from "@/lib/auth/claims";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Role } from "@/lib/auth/roles";
import { categoryUpsertSchema } from "@/lib/schemas/category-upsert";

export type AdminActionResult<T = undefined> =
  | { error: null; data: T }
  | { error: string; code?: "validation" | "db" | "auth" };

export type UserRow = {
  id: string;
  role: "admin" | "it" | "client";
  email: string;
  display_name: string | null;
  is_active: boolean;
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
    return { error: "Unauthorized", code: "auth" };
  }
  return { error: null, data: { role, sub: sub ?? "" } };
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

  return { error: null, data: (data ?? []) as UserRow[] };
}

export async function deactivateUser(
  userId: string
): Promise<AdminActionResult> {
  const authResult = await requireAdmin();
  if (authResult.error !== null) return authResult;
  const { sub } = authResult.data;

  if (userId === sub) {
    return { error: "Cannot deactivate your own account", code: "auth" };
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
  userId: string
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
      error: parsed.error.issues[0]?.message ?? "Invalid input",
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
        error: "A category with this name already exists.",
        code: "db",
      };
    }
    return { error: error.message, code: "db" };
  }

  return { error: null, data: data as CategoryRow };
}

export async function updateCategory(
  categoryId: string,
  input: { name?: string; is_enabled?: boolean }
): Promise<AdminActionResult<CategoryRow>> {
  const authResult = await requireAdmin();
  if (authResult.error !== null) return authResult;

  if (input.name !== undefined) {
    const parsed = categoryUpsertSchema
      .pick({ name: true })
      .safeParse({ name: input.name });
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message ?? "Invalid input",
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
        error: "A category with this name already exists.",
        code: "db",
      };
    }
    return { error: error.message, code: "db" };
  }

  return { error: null, data: data as CategoryRow };
}
