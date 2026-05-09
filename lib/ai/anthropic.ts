import Anthropic from "@anthropic-ai/sdk";

export const CLAUDE_HAIKU_MODEL = "claude-haiku-4-5";

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key.includes("placeholder")) return null;
  if (!client) client = new Anthropic({ apiKey: key });
  return client;
}

export function isAnthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY.includes("placeholder"));
}
