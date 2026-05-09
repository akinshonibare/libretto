"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { validateHandle } from "@/lib/handle";
import { updateProfileAction } from "@/app/actions/profile";

type Props = {
  initialHandle: string;
  initialDisplayName: string | null;
  initialBio: string | null;
};

export function ProfileEditor({ initialHandle, initialDisplayName, initialBio }: Props) {
  const router = useRouter();
  const [handle, setHandle] = useState(initialHandle);
  const [displayName, setDisplayName] = useState(initialDisplayName ?? "");
  const [bio, setBio] = useState(initialBio ?? "");
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const localValidation = validateHandle(handle);
  const handleChanged = handle.trim().toLowerCase() !== initialHandle;
  const dirty =
    handleChanged ||
    displayName.trim() !== (initialDisplayName ?? "").trim() ||
    bio.trim() !== (initialBio ?? "").trim();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const validated = validateHandle(handle);
    if (!validated.ok) {
      setError(validated.reason);
      return;
    }

    const fd = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await updateProfileAction(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setHandle(result.handle);
      setSavedAt(Date.now());
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="handle">Username</Label>
        <div className="flex items-stretch overflow-hidden rounded-md border border-[var(--input)] bg-[var(--card)] focus-within:ring-2 focus-within:ring-[var(--ring)] focus-within:ring-offset-2 focus-within:ring-offset-[var(--background)]">
          <span className="flex items-center px-3 text-sm text-[var(--muted-foreground)]">
            libretto.akinshonibare.com/u/
          </span>
          <input
            id="handle"
            name="handle"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            className="flex-1 border-l border-[var(--input)] bg-transparent px-3 py-2 text-sm focus:outline-none"
          />
        </div>
        <p
          className={`text-xs ${
            !localValidation.ok && handleChanged
              ? "text-[var(--destructive)]"
              : "text-[var(--muted-foreground)]"
          }`}
        >
          {handleChanged && !localValidation.ok
            ? localValidation.reason
            : "3–30 characters · lowercase letters, numbers, underscores. Must start with a letter."}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="display_name">Display name</Label>
        <Input
          id="display_name"
          name="display_name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={80}
          placeholder={`@${handle}`}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bio">Bio</Label>
        <Textarea
          id="bio"
          name="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={280}
          rows={3}
          placeholder="A short line about your reading."
        />
        <p className="text-xs text-[var(--muted-foreground)]">{280 - bio.length} characters left.</p>
      </div>

      {error && (
        <p className="text-sm text-[var(--destructive)]" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || !dirty || !localValidation.ok}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Save
        </Button>
        {savedAt && Date.now() - savedAt < 4000 && (
          <span className="inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)]">
            <Check className="size-4" /> Saved
          </span>
        )}
        {handleChanged && (
          <p className="text-xs text-[var(--muted-foreground)]">
            Changing your username changes your public URL — old links will break.
          </p>
        )}
      </div>
    </form>
  );
}
