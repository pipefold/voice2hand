import Link from "next/link";

const testPages = [
  {
    href: "/test-deepgram",
    title: "Deepgram Live Transcription",
    description: "Wire up microphone streaming into Deepgram’s realtime API.",
  },
  {
    href: "/test-open-hand",
    title: "OpenHand Tracker UI",
    description: "Render a mocked poker hand using open-hand-tracker.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 py-16 text-zinc-50">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 rounded-3xl bg-zinc-900 p-10 shadow-2xl ring-1 ring-zinc-800">
        <section className="flex flex-col gap-3">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">
            Voice2Hand Playground
          </p>
          <h1 className="text-3xl font-semibold">Prototype hub</h1>
          <p className="text-zinc-400">
            Quick access to scratchpads while we stitch together speech,
            transcription, and gesture output. Use the test pages below to poke
            at integrations without touching the main experience.
          </p>
        </section>

        <section className="grid gap-4">
          {testPages.map((page) => (
            <Link
              key={page.href}
              href={page.href}
              className="group rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 transition hover:border-emerald-500/60 hover:bg-zinc-900"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-wide text-zinc-400">
                    Test Page
                  </p>
                  <h2 className="text-xl font-semibold text-zinc-50">
                    {page.title}
                  </h2>
                </div>
                <span className="text-emerald-400 transition group-hover:translate-x-1">
                  →
                </span>
              </div>
              <p className="mt-3 text-sm text-zinc-400">{page.description}</p>
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
}
