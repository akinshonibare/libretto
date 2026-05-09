import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ThemePicker } from "@/components/theme-picker";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      >
        <ChevronLeft className="size-4" /> Back
      </Link>
      <h1 className="font-heading text-4xl tracking-tight mt-4">Settings</h1>
      <p className="mt-2 text-[var(--muted-foreground)]">
        Pick how Libretto looks. Changes apply instantly and stick across visits.
      </p>
      <div className="mt-10">
        <ThemePicker />
      </div>
    </div>
  );
}
