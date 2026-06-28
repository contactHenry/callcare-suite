/**
 * Contact-method server fns for the Phase 1 client_contact_methods table.
 * Reads are visible to any signed-in user (per RLS); writes require
 * `clients:edit`. All mutations audit-log.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requirePermission, audit } from "./permissions.functions";

const METHOD = z.enum(["phone", "email", "sms", "whatsapp", "no_contact"]);

function normalize(value: string, method: string): string {
  if (method === "email") return value.trim().toLowerCase();
  return value.replace(/[^0-9+]/g, "");
}

export const listContactMethods = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { clientId: string }) =>
    z.object({ clientId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as { supabase: any };
    const { data: rows, error } = await supabase
      .from("client_contact_methods")
      .select("id, client_id, method, value, normalized_value, label, is_primary, verified_at, created_at")
      .eq("client_id", data.clientId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) throw new Response(error.message, { status: 400 });
    return { methods: rows ?? [] };
  });

export const addContactMethod = createServerFn({ method: "POST" })
  .middleware([requirePermission("clients:edit")])
  .inputValidator((d: {
    clientId: string; method: string; value: string;
    label?: string; isPrimary?: boolean;
  }) =>
    z.object({
      clientId: z.string().uuid(),
      method: METHOD,
      value: z.string().trim().min(2).max(180),
      label: z.string().trim().max(40).optional(),
      isPrimary: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: parent } = await supabase
      .from("contacts").select("organization_id").eq("id", data.clientId).maybeSingle();
    if (data.isPrimary) {
      await supabase.from("client_contact_methods")
        .update({ is_primary: false })
        .eq("client_id", data.clientId)
        .eq("method", data.method);
    }
    const { data: row, error } = await supabase.from("client_contact_methods").insert({
      client_id: data.clientId,
      organization_id: parent?.organization_id ?? null,
      method: data.method,
      value: data.value,
      normalized_value: normalize(data.value, data.method),
      label: data.label ?? null,
      is_primary: !!data.isPrimary,
    }).select("id").single();
    if (error) throw new Response(error.message, { status: 400 });
    await audit(supabase, userId, "contact_method.add", "contact", data.clientId, {
      method: data.method, label: data.label, primary: !!data.isPrimary,
    });
    return { id: row.id as string };
  });

export const setPrimaryContactMethod = createServerFn({ method: "POST" })
  .middleware([requirePermission("clients:edit")])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: row } = await supabase.from("client_contact_methods")
      .select("client_id, method").eq("id", data.id).maybeSingle();
    if (!row) throw new Response("Not found", { status: 404 });
    await supabase.from("client_contact_methods")
      .update({ is_primary: false })
      .eq("client_id", row.client_id).eq("method", row.method);
    const { error } = await supabase.from("client_contact_methods")
      .update({ is_primary: true }).eq("id", data.id);
    if (error) throw new Response(error.message, { status: 400 });
    await audit(supabase, userId, "contact_method.set_primary", "contact", row.client_id, { id: data.id });
    return { ok: true };
  });

export const deleteContactMethod = createServerFn({ method: "POST" })
  .middleware([requirePermission("clients:edit")])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: row } = await supabase.from("client_contact_methods")
      .select("client_id").eq("id", data.id).maybeSingle();
    const { error } = await supabase.from("client_contact_methods").delete().eq("id", data.id);
    if (error) throw new Response(error.message, { status: 400 });
    await audit(supabase, userId, "contact_method.delete", "contact", row?.client_id ?? data.id, {});
    return { ok: true };
  });