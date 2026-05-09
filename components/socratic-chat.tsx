"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ReadingMode } from "@/lib/supabase/types";

type Message = { role: "user" | "assistant"; content: string };

const MODES: Array<{ id: ReadingMode; label: string; hint: string }> = [
  { id: "absorb", label: "Absorb", hint: "Soak it in." },
  { id: "study", label: "Study", hint: "Probe me." },
  { id: "challenge", label: "Challenge", hint: "Push back." },
  { id: "apply", label: "Apply", hint: "Make it useful." },
  { id: "enjoy", label: "Enjoy", hint: "Riff." },
];

export function SocraticChat({
  reviewId,
  initialMessages,
  initialMode,
  configured,
}: {
  reviewId: string;
  initialMessages: Message[];
  initialMode: ReadingMode;
  configured: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<ReadingMode>(initialMode);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  async function send() {
    if (!draft.trim() || streaming) return;
    if (!configured) {
      setError("Set ANTHROPIC_API_KEY in your env to enable Socratic chat.");
      return;
    }
    const message = draft.trim();
    setDraft("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: message }, { role: "assistant", content: "" }]);
    setStreaming(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId, mode, message }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const block of events) {
          const line = block.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.type === "delta") {
              setMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = {
                  role: "assistant",
                  content: next[next.length - 1].content + payload.text,
                };
                return next;
              });
            } else if (payload.type === "error") {
              setError(payload.message);
            }
          } catch {}
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Chat failed.";
      setError(message);
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setStreaming(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-[var(--accent)]" />
            <span className="text-sm font-medium">Socratic chat</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-xs",
                  mode === m.id
                    ? "border-[var(--ring)] bg-[var(--accent)]/30"
                    : "border-[var(--border)] hover:border-[var(--ring)]"
                )}
                title={m.hint}
              >
                {m.label}
              </button>
            ))}
          </div>
        </header>

        <div
          ref={scrollerRef}
          className="max-h-96 space-y-3 overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--background)] p-3"
        >
          {messages.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">
              Ask anything about this book — the model sees your highlights and notes.
            </p>
          ) : (
            messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-md px-3 py-2 text-sm leading-relaxed",
                  m.role === "user"
                    ? "ml-8 bg-[var(--secondary)]"
                    : "mr-8 bg-[var(--card)] border border-[var(--border)]"
                )}
              >
                {m.role === "assistant" ? (
                  m.content ? (
                    <div className="chat-prose">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                    </div>
                  ) : streaming && i === messages.length - 1 ? (
                    "…"
                  ) : (
                    ""
                  )
                ) : (
                  <span className="whitespace-pre-wrap">{m.content}</span>
                )}
              </div>
            ))
          )}
        </div>

        {error && (
          <p className="text-xs text-[var(--destructive)]" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-end gap-2">
          <Textarea
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={`Ask in ${MODES.find((m) => m.id === mode)?.label} mode… (⌘↵ to send)`}
            disabled={streaming}
          />
          <Button onClick={send} disabled={streaming || !draft.trim()}>
            {streaming ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
