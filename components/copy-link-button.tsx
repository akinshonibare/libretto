"use client";

import { useState } from "react";
import { Check, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.warn("[copy-link]", err);
    }
  }

  return (
    <Button onClick={copy} variant="outline" size="sm">
      {copied ? <Check className="size-4" /> : <LinkIcon className="size-4" />}
      {copied ? "Copied" : "Copy link"}
    </Button>
  );
}
