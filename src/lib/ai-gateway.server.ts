/**
 * Server-only helper for calling the Lovable AI Gateway (OpenAI-compatible
 * chat completions). Kept in a `.server.ts` file so `process.env.LOVABLE_API_KEY`
 * never leaks into the client bundle.
 */
export async function chatComplete(opts: {
  model?: string;
  system?: string;
  user: string;
  temperature?: number;
}): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Response("Missing LOVABLE_API_KEY", { status: 500 });
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
    },
    body: JSON.stringify({
      model: opts.model ?? "google/gemini-3-flash-preview",
      temperature: opts.temperature ?? 0.6,
      messages: [
        ...(opts.system ? [{ role: "system", content: opts.system }] : []),
        { role: "user", content: opts.user },
      ],
    }),
  });
  if (res.status === 429) throw new Response("AI rate limit reached — please retry shortly.", { status: 429 });
  if (res.status === 402) throw new Response("AI credits exhausted — top up in workspace billing.", { status: 402 });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Response(`AI gateway error (${res.status}): ${t.slice(0, 200)}`, { status: 500 });
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content ?? "";
}