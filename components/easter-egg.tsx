"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/components/theme-provider";

const KEYWORD = "borges";
const QUOTE = "Heaven will be a kind of library.";
const REVEAL_MS = 2400;

export function EasterEgg() {
  const { setTheme } = useTheme();
  const buffer = useRef("");
  const armed = useRef(true);
  const [revealing, setRevealing] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.length !== 1 || e.metaKey || e.ctrlKey || e.altKey) return;
      buffer.current = (buffer.current + e.key.toLowerCase()).slice(-KEYWORD.length);
      if (armed.current && buffer.current === KEYWORD) {
        armed.current = false;
        buffer.current = "";
        setRevealing(true);
        setTheme({ palette: "midnight-library" });
        window.setTimeout(() => {
          setRevealing(false);
          armed.current = true;
        }, REVEAL_MS);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setTheme]);

  if (!revealing) return null;
  return (
    <div className="easter-reveal" aria-hidden>
      <p className="easter-reveal-quote">{QUOTE}</p>
    </div>
  );
}
