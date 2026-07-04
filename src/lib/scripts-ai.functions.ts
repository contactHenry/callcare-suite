/**
 * AI-assisted call-script authoring. Given a use case (and optional title,
 * category, tone), asks Lovable AI to produce a structured script that the
 * UI turns into a linear tree of `say` nodes for immediate editing.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type GeneratedScript = {
  title: string;
  useCase: string;
  steps: { kind: "say" | "question" | "objection" | "compliance" | "faq"; text: string }[];
};

const Input = z.object({
  title: z.string().max(160).optional().default(""),
  useCase: z.string().min(4).max(2000),
  category: z.string().max(80).optional().default(""),
  tone: z.string().max(80).optional().default("professional, warm, concise"),
});

export const generateScriptDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<GeneratedScript> => {
    const { chatComplete } = await import("./ai-gateway.server");
    const system = [
      "You are a call-centre scripting assistant.",
      "Produce a branching-friendly call script as strict JSON with the shape:",
      `{"title": string, "useCase": string, "steps": [{"kind":"say"|"question"|"compliance"|"objection"|"faq","text": string}]}`,
      "Rules: 6-12 steps. Start with a greeting (say), then compliance/recording notice if relevant,",
      "then discovery questions, value pitch, objection handlers, and a clear close.",
      "Use `{{client_name}}`, `{{agent_name}}` placeholders where natural. Keep each step under 240 chars.",
      "Return ONLY the JSON, no markdown fences, no commentary.",
    ].join(" ");
    const user = [
      `Use case: ${data.useCase}`,
      data.title ? `Suggested title: ${data.title}` : "",
      data.category ? `Category: ${data.category}` : "",
      `Tone: ${data.tone}`,
    ].filter(Boolean).join("\n");

    const raw = await chatComplete({ system, user, temperature: 0.6 });
    const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    let parsed: GeneratedScript;
    try {
      parsed = JSON.parse(cleaned) as GeneratedScript;
    } catch {
      // Fallback: treat lines as `say` steps.
      const lines = cleaned.split(/\r?\n/).map((l) => l.replace(/^[-*\d.\s]+/, "").trim()).filter(Boolean);
      parsed = {
        title: data.title || "Untitled script",
        useCase: data.useCase,
        steps: lines.slice(0, 12).map((text) => ({ kind: "say" as const, text })),
      };
    }
    // Defensive normalisation.
    const allowed = new Set(["say", "question", "objection", "compliance", "faq"]);
    parsed.steps = (parsed.steps ?? [])
      .filter((s) => s && typeof s.text === "string" && s.text.trim().length > 0)
      .map((s) => ({ kind: (allowed.has(s.kind as string) ? s.kind : "say") as GeneratedScript["steps"][number]["kind"], text: s.text.trim() }))
      .slice(0, 20);
    parsed.title = (parsed.title || data.title || "Untitled script").slice(0, 160);
    parsed.useCase = (parsed.useCase || data.useCase).slice(0, 2000);
    return parsed;
  });