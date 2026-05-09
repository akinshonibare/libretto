"use client";

import { useState, useTransition } from "react";
import { Share2, Copy, Image as ImageIcon, Link as LinkIcon, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getOrCreateShareTokenAction } from "@/app/actions/share";

type Props = {
  reviewId: string;
  isPublic: boolean;
  siteUrl: string;
  bookTitle: string;
  authorHandle: string;
};

export function ShareMenu({ reviewId, isPublic, siteUrl, bookTitle, authorHandle }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState<string | null>(null);

  function ensureLink(): string {
    const tokenSuffix = isPublic || !token ? "" : `?t=${token}`;
    return `${siteUrl}/r/${reviewId}${tokenSuffix}`;
  }

  function ensureImage(): string {
    const tokenSuffix = isPublic || !token ? "" : `?t=${token}`;
    return `${siteUrl}/api/og/review/${reviewId}${tokenSuffix}`;
  }

  function maybeMintToken(after: () => void) {
    if (isPublic || token) return after();
    startTransition(async () => {
      const t = await getOrCreateShareTokenAction(reviewId);
      if (t) setToken(t);
      after();
    });
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch (err) {
      console.warn("[share] copy failed", err);
    }
  }

  async function copyImage(url: string) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      const blob = await res.blob();
      const png = await convertToPng(blob);
      await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
      setCopied("image");
      setTimeout(() => setCopied(null), 1500);
    } catch (err) {
      console.warn("[share] image copy failed", err);
      window.open(url, "_blank");
    }
  }

  async function downloadPng(url: string) {
    const res = await fetch(url, { cache: "no-store" });
    const blob = await res.blob();
    const png = await convertToPng(blob);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(png);
    a.download = `libretto-${slug(bookTitle)}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function nativeShare(link: string) {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${bookTitle} — @${authorHandle}`,
          text: `My notes on ${bookTitle}`,
          url: link,
        });
      } catch {
        // user cancelled — no-op
      }
    } else {
      copy(link, "link");
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={() => maybeMintToken(() => copy(ensureLink(), "link"))}
        disabled={pending}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> :
          copied === "link" ? <Check className="size-4" /> : <LinkIcon className="size-4" />}
        Copy link
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => maybeMintToken(() => copyImage(ensureImage()))}
        disabled={pending}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> :
          copied === "image" ? <Check className="size-4" /> : <Copy className="size-4" />}
        Copy image
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => maybeMintToken(() => downloadPng(ensureImage()))}
        disabled={pending}
      >
        <ImageIcon className="size-4" />
        Download PNG
      </Button>
      <Button
        size="sm"
        onClick={() => maybeMintToken(() => nativeShare(ensureLink()))}
        disabled={pending}
      >
        <Share2 className="size-4" />
        Share
      </Button>
    </div>
  );
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").slice(0, 60);
}

// ImageResponse returns PNG already, but copying via the Clipboard API requires a PNG blob.
// Pass it through unchanged when the response is already image/png.
async function convertToPng(blob: Blob): Promise<Blob> {
  if (blob.type === "image/png") return blob;
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b!), "image/png")
  );
}
