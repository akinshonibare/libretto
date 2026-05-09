import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CLAUDE_HAIKU_MODEL, getAnthropicClient, isAnthropicConfigured } from "@/lib/ai/anthropic";
import {
  buildContextBlock,
  buildSocraticSystemPrompt,
} from "@/lib/ai/socratic";
import {
  estimateChatCostCents,
  getUsageToday,
  recordUsage,
} from "@/lib/ai/budget";
import type { HighlightRow, ChapterNoteRow, ReviewDetailRow } from "@/lib/queries";
import type { ReadingMode } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_MODES: ReadingMode[] = ["absorb", "study", "challenge", "apply", "enjoy"];

type ChatRequest = {
  reviewId: string;
  mode?: ReadingMode;
  message: string;
};

export async function POST(request: Request) {
  if (!isAnthropicConfigured()) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured." },
      { status: 503 }
    );
  }
  const client = getAnthropicClient();
  if (!client) {
    return NextResponse.json({ error: "anthropic-init-failed" }, { status: 500 });
  }

  let body: ChatRequest;
  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }
  const { reviewId, message } = body;
  const mode = body.mode && VALID_MODES.includes(body.mode) ? body.mode : "enjoy";
  if (!reviewId || typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "missing-fields" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Budget gate
  const usage = await getUsageToday(supabase, user.id);
  if (usage.remainingCents <= 0) {
    return NextResponse.json(
      { error: "budget-exhausted", spent: usage.spentCents, budget: usage.budgetCents },
      { status: 402 }
    );
  }

  // Load review + book + highlights + chapter notes (RLS scopes to user's reviews automatically)
  const { data: review } = await supabase
    .from("reviews")
    .select(
      "id, user_id, status, rating, liked, why, synopsis, reading_mode, is_public, updated_at, books(title, author, cover_url, year, slug)"
    )
    .eq("id", reviewId)
    .returns<ReviewDetailRow[]>()
    .maybeSingle();
  if (!review || review.user_id !== user.id) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  const [{ data: highlights }, { data: notes }, { data: history }] = await Promise.all([
    supabase
      .from("highlights")
      .select("id, body, page, source, created_at")
      .eq("review_id", reviewId)
      .order("created_at", { ascending: false })
      .limit(40)
      .returns<HighlightRow[]>(),
    supabase
      .from("chapter_notes")
      .select("id, label, body, page, created_at")
      .eq("review_id", reviewId)
      .order("created_at", { ascending: true })
      .returns<ChapterNoteRow[]>(),
    supabase
      .from("chat_messages")
      .select("role, content")
      .eq("review_id", reviewId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(20),
  ]);

  const book = review.books;
  const contextBlock = buildContextBlock({
    bookTitle: book?.title ?? "Untitled",
    bookAuthor: book?.author ?? null,
    highlights: (highlights ?? []).slice().reverse().map((h) => ({ body: h.body, page: h.page })),
    chapterNotes: (notes ?? []).map((n) => ({ label: n.label, body: n.body, page: n.page })),
    why: review.why,
    synopsis: review.synopsis,
  });

  // Two cached system blocks: stable system prompt + book/highlights context.
  // cache_control on the last block means the API caches both — system + context — together.
  const system = [
    { type: "text" as const, text: buildSocraticSystemPrompt(mode) },
    {
      type: "text" as const,
      text: contextBlock,
      cache_control: { type: "ephemeral" as const },
    },
  ];

  const priorMessages = (history ?? [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const messages = [...priorMessages, { role: "user" as const, content: message }];

  // Persist the user message immediately.
  await supabase.from("chat_messages").insert({
    review_id: reviewId,
    user_id: user.id,
    role: "user",
    content: message,
    mode,
  });

  const llmStream = client.messages.stream({
    model: CLAUDE_HAIKU_MODEL,
    max_tokens: 1024,
    system,
    messages,
  });

  const encoder = new TextEncoder();
  const sendEvent = (controller: ReadableStreamDefaultController, payload: unknown) => {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
  };

  const stream = new ReadableStream({
    async start(controller) {
      let assistantText = "";
      try {
        for await (const event of llmStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            assistantText += event.delta.text;
            sendEvent(controller, { type: "delta", text: event.delta.text });
          }
        }

        const final = await llmStream.finalMessage();
        const inputTokens =
          (final.usage.input_tokens ?? 0) +
          (final.usage.cache_creation_input_tokens ?? 0) +
          (final.usage.cache_read_input_tokens ?? 0);
        const outputTokens = final.usage.output_tokens ?? 0;
        const cost = estimateChatCostCents(inputTokens, outputTokens);

        await Promise.all([
          supabase.from("chat_messages").insert({
            review_id: reviewId,
            user_id: user.id,
            role: "assistant",
            content: assistantText,
            mode,
          }),
          recordUsage(supabase, user.id, "anthropic", CLAUDE_HAIKU_MODEL, inputTokens, outputTokens, cost),
        ]);

        sendEvent(controller, {
          type: "done",
          usage: {
            inputTokens,
            outputTokens,
            cacheReadTokens: final.usage.cache_read_input_tokens ?? 0,
            cacheCreationTokens: final.usage.cache_creation_input_tokens ?? 0,
            costCents: cost,
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "unknown";
        console.error("[ai/chat]", err);
        sendEvent(controller, { type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}
