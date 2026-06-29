/**
 * Call-script server functions: branching tree, versioning, approval
 * workflow, agent acknowledgements. The tree is stored as JSONB; the UI
 * walks it during a live call. See `ScriptNode` for the shape contract.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { audit } from "./permissions.functions";

/** Public contract for the JSON script tree consumed by the live-call UI. */
export type ScriptNode = {
  id: string;
  kind: "say" | "question" | "objection" | "compliance" | "faq";
  text: string;
  mandatory?: boolean;
  /** Map: client answer (free string) -> next node id. */
  branches?: { value: string; nextId: string }[];
  /** Default next id when no branch matches. */
  nextId?: string;
};

export const listScripts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { campaignId?: string | null } | undefined) =>
    z.object({ campaignId: z.string().uuid().nullish() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("call_scripts")
      .select("*, current_version:call_script_versions!call_scripts_current_version_fk(id,version,status,approved_at)")
      .order("updated_at", { ascending: false });
    if (data.campaignId) q = q.eq("campaign_id", data.campaignId);
    const { data: rows, error } = await q;
    if (error) throw new Response(error.message, { status: 500 });
    return rows ?? [];
  });

export const getScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: script, error } = await supabase
      .from("call_scripts").select("*").eq("id", data.id).single();
    if (error) throw new Response(error.message, { status: 500 });
    const { data: versions } = await supabase
      .from("call_script_versions").select("*").eq("script_id", data.id)
      .order("version", { ascending: false });
    return { script, versions: versions ?? [] };
  });

export const createScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string; description?: string; campaignId?: string | null }) =>
    z.object({
      name: z.string().min(1).max(160),
      description: z.string().max(2000).optional(),
      campaignId: z.string().uuid().nullish(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: script, error } = await supabase.from("call_scripts").insert({
      name: data.name,
      description: data.description ?? null,
      campaign_id: data.campaignId ?? null,
      created_by: userId,
    }).select().single();
    if (error) throw new Response(error.message, { status: 500 });
    const { data: v1, error: ve } = await supabase.from("call_script_versions").insert({
      script_id: script.id, version: 1, status: "draft", tree: { rootId: null, nodes: [] }, created_by: userId,
    }).select().single();
    if (ve) throw new Response(ve.message, { status: 500 });
    await supabase.from("call_scripts").update({ current_version_id: v1.id }).eq("id", script.id);
    await audit(supabase, userId, "script.create", "call_script", script.id, { name: data.name });
    return { script, version: v1 };
  });

export const saveScriptDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { scriptId: string; tree: unknown; changelog?: string }) =>
    z.object({
      scriptId: z.string().uuid(),
      tree: z.any(),
      changelog: z.string().max(1000).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: latest } = await supabase
      .from("call_script_versions").select("id,version,status")
      .eq("script_id", data.scriptId).order("version", { ascending: false }).limit(1).maybeSingle();
    if (latest?.status === "draft") {
      const { error } = await supabase.from("call_script_versions")
        .update({ tree: data.tree, changelog: data.changelog ?? null }).eq("id", latest.id);
      if (error) throw new Response(error.message, { status: 500 });
      return { id: latest.id, version: latest.version };
    }
    const nextVersion = (latest?.version ?? 0) + 1;
    const { data: row, error } = await supabase.from("call_script_versions").insert({
      script_id: data.scriptId, version: nextVersion, status: "draft",
      tree: data.tree, changelog: data.changelog ?? null, created_by: userId,
    }).select().single();
    if (error) throw new Response(error.message, { status: 500 });
    return { id: row.id, version: row.version };
  });

export const submitScriptForReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { versionId: string }) => z.object({ versionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("call_script_versions")
      .update({ status: "in_review" }).eq("id", data.versionId);
    if (error) throw new Response(error.message, { status: 500 });
    await audit(supabase, userId, "script.submit_review", "call_script_version", data.versionId, {});
    return { ok: true };
  });

export const approveScriptVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { versionId: string }) => z.object({ versionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: v, error } = await supabase
      .from("call_script_versions")
      .update({ status: "approved", approved_by: userId, approved_at: new Date().toISOString() })
      .eq("id", data.versionId).select("script_id,id").single();
    if (error) throw new Response(error.message, { status: 500 });
    await supabase.from("call_scripts").update({ current_version_id: v.id }).eq("id", v.script_id);
    await audit(supabase, userId, "script.approve", "call_script_version", data.versionId, {});
    return { ok: true };
  });

export const acknowledgeScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { versionId: string }) => z.object({ versionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("script_acknowledgements")
      .upsert({ version_id: data.versionId, user_id: userId }, { onConflict: "version_id,user_id" });
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true };
  });

/**
 * Fetches the currently-approved script for a campaign (used by the
 * in-call live-script panel). Returns null if no approved script exists.
 */
export const getActiveCampaignScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { campaignId?: string | null } | undefined) =>
    z.object({ campaignId: z.string().uuid().nullish() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase.from("call_scripts").select("id, name, current_version_id");
    if (data.campaignId) q = q.eq("campaign_id", data.campaignId);
    else q = q.is("campaign_id", null);
    const { data: scripts } = await q.limit(1);
    const script = scripts?.[0];
    if (!script?.current_version_id) return null;
    const { data: version } = await supabase
      .from("call_script_versions")
      .select("id, version, status, tree, approved_at")
      .eq("id", script.current_version_id)
      .maybeSingle();
    if (!version || version.status !== "approved") return null;
    const { data: ack } = await supabase
      .from("script_acknowledgements")
      .select("acknowledged_at")
      .eq("version_id", version.id)
      .eq("user_id", userId)
      .maybeSingle();
    return {
      scriptId: script.id,
      name: script.name,
      version,
      acknowledged: !!ack,
    };
  });