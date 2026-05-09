/**
 * Username/handle validation. Same rules used on the client (form-level feedback)
 * and server (the canonical check).
 */

const RESERVED = new Set([
  "admin", "administrator", "api", "app", "auth", "callback", "dashboard",
  "discover", "help", "library", "login", "logout", "logs", "manifest", "me",
  "media", "new", "notifications", "offline", "owner", "profile", "public",
  "r", "register", "root", "search", "session", "sessions", "settings",
  "signin", "signout", "signup", "site", "static", "support", "system",
  "today", "u", "user", "users", "www",
]);

const HANDLE_RE = /^[a-z][a-z0-9_]{2,29}$/;

export type HandleValidation =
  | { ok: true; normalized: string }
  | { ok: false; reason: string };

export function validateHandle(input: string): HandleValidation {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return { ok: false, reason: "Username can't be empty." };
  if (trimmed.length < 3) return { ok: false, reason: "At least 3 characters." };
  if (trimmed.length > 30) return { ok: false, reason: "30 characters max." };
  if (!HANDLE_RE.test(trimmed)) {
    return {
      ok: false,
      reason: "Use lowercase letters, numbers, or underscores. Must start with a letter.",
    };
  }
  if (trimmed.includes("__")) return { ok: false, reason: "No double underscores." };
  if (RESERVED.has(trimmed)) return { ok: false, reason: "That username is reserved." };
  return { ok: true, normalized: trimmed };
}
