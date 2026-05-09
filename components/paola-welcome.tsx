import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/logo-mark";
import { dismissPaolaWelcomeAction } from "@/app/actions/welcome";

/**
 * The dedication page. Shown when `/?for_paola=true` is hit and the
 * libretto_paola_welcomed cookie hasn't been set yet. Clicking "Enter
 * Libretto" runs dismissPaolaWelcomeAction which sets the cookie and
 * redirects back to `/`.
 *
 * Voice: warmer than the rest of the site (this is a dedication), but still
 * direct and unhurried. The name reveal is the hook.
 */
export function PaolaWelcome() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 sm:py-24">
      <header className="flex flex-col items-start gap-4">
        <LogoMark size={56} className="text-[var(--foreground)]" />
        <p className="label-eyebrow">A small gift, i hope you like and use it</p>
      </header>

      <h1 className="mt-8 font-heading text-5xl leading-[1.05] tracking-tight md:text-6xl">
        Your name means
        <br />
        <em className="text-[var(--ink-quote)]">blessing from God</em>.
      </h1>
      <p className="mt-3 font-heading text-2xl leading-tight text-[var(--muted-foreground)]">
        So made you a little book, for something weighty to you.
      </p>

      <div className="mt-10 space-y-4 leading-relaxed">
        <p>
          And your name carries another meaning too: <span className="prose-quote">small</span>,
          <span className="prose-quote"> humble</span>. Not small in worth — small in the way the
          best things often are.
        </p>
        <p>
          A note folded into a pocket. A worn book with marked pages. A sentence you return to
          years later and somehow need even more.
        </p>
        <p>
          That felt right for this.
        </p>
        <p>
          A quiet place for thoughts worth keeping. A little book that grows heavier the longer it
          stays with you.
        </p>
        <p>
          So when it came time to name it, the answer was already there.
        </p>
      </div>

      <p className="prose-quote mt-10 text-xl leading-snug">
        Libretto.
        <br />
        A small, humble place for the books you read.
      </p>

      <section className="mt-12">
        <p className="label-eyebrow">What&rsquo;s inside</p>
        <div className="mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-2">
          <FeatureGroup
            title="Capture"
            items={[
              "Add a book — search OpenLibrary or type the spine.",
              "Why you liked it, why you didn't, what you'd come back for.",
              "Highlights and chapter notes captured in five reading modes: Absorb, Study, Challenge, Apply, Enjoy.",
            ]}
          />
          <FeatureGroup
            title="Resurface"
            items={[
              "Spaced repetition pulls old highlights back at the right moment.",
              "A Today page grades them — Forgot, Familiar, Mastered.",
              "Streaks, badges, and a Library Heart score watch over the habit.",
              "Concepts auto-extract into a knowledge graph that connects ideas across books.",
            ]}
          />
          <FeatureGroup
            title="Think"
            items={[
              "Socratic chat with Claude — book-aware, mode-aware, terse on purpose.",
              "Recommendations shaped by what you've read and rated.",
            ]}
          />
          <FeatureGroup
            title="Share"
            items={[
              "One review, one beautiful card. Unfurls cleanly in messages.",
              "Public, private, or unlisted — your call.",
              "Reactions: ★, this hit, bookmark.",
            ]}
          />
          <FeatureGroup
            title="Together"
            items={[
              "Follow other readers. A quiet feed of public reviews.",
              "Book clubs. One book at a time. Threaded discussion.",
            ]}
          />
          <FeatureGroup
            title="Make it yours"
            items={[
              "Six palettes; light, dark, or system; serif, sans, or both.",
              "Installable to your phone's home screen.",
              "Edit your handle, display name, and bio whenever the mood strikes.",
            ]}
          />
        </div>
      </section>

      <form action={dismissPaolaWelcomeAction} className="mt-14">
        <Button type="submit" size="lg" className="gap-2">
          Enter Libretto <ArrowRight className="size-4" />
        </Button>
        <p className="mt-3 text-xs text-[var(--muted-foreground)]">
          One click and you&rsquo;re in. We won&rsquo;t show this page again.
        </p>
      </form>
    </div>
  );
}

function FeatureGroup({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="font-heading text-xl">{title}</h3>
      <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-[var(--muted-foreground)]">
        {items.map((item, i) => (
          <li key={i}>— {item}</li>
        ))}
      </ul>
    </div>
  );
}
