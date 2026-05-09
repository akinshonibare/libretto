import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, Sparkles, Network, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SiteHeader } from "@/components/site-header";
import { getSessionContext } from "@/lib/auth-helpers";

export default async function Home() {
  const { user } = await getSessionContext();
  if (user) redirect("/dashboard");
  return <Landing />;
}

function Landing() {
  return (
    <div className="flex flex-col flex-1">
      <SiteHeader />

      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-6 py-24">
          <p className="mb-4 text-sm uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
            Your little book
          </p>
          <h1 className="font-heading text-5xl leading-[1.05] tracking-tight md:text-7xl">
            A small, humble place
            <br /> for the books you read.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-[var(--muted-foreground)]">
            Capture reviews, highlights, and chapter notes. Resurface ideas at the right time. See
            how your reading connects across books — and share what hits.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/auth/sign-in">
              <Button size="lg">Start a journal</Button>
            </Link>
            <Link href="/settings">
              <Button size="lg" variant="outline">
                Pick a theme
              </Button>
            </Link>
          </div>
        </section>

        <section className="border-t border-[var(--border)] bg-[var(--card)]/40">
          <div className="mx-auto grid max-w-5xl gap-6 px-6 py-16 md:grid-cols-2">
            <Feature
              icon={<BookOpen className="size-5" />}
              title="Capture as you read"
              body="Title, status, why you liked or didn't, your synopsis, intriguing chapters. Search OpenLibrary or add manually."
            />
            <Feature
              icon={<Share2 className="size-5" />}
              title="Share, beautifully"
              body="Tweet-style image cards plus a canonical link to your review. Send to a story or a thread, your call."
            />
            <Feature
              icon={<Sparkles className="size-5" />}
              title="Resurface what matters"
              body="Spaced-repetition pulls old highlights back at the right moment. Streaks and badges keep the habit alive."
            />
            <Feature
              icon={<Network className="size-5" />}
              title="Your mind, mapped"
              body="Concepts auto-link across your reading. See ideas you've connected — and ones you didn't notice were related."
            />
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--border)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6 text-sm text-[var(--muted-foreground)]">
          <span>Libretto · little book, big notes</span>
          <Link href="/settings" className="hover:underline">
            Theme settings
          </Link>
        </div>
      </footer>
    </div>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-3 inline-flex size-9 items-center justify-center rounded-md bg-[var(--accent)] text-[var(--accent-foreground)]">
          {icon}
        </div>
        <h3 className="font-heading text-xl">{title}</h3>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">{body}</p>
      </CardContent>
    </Card>
  );
}
