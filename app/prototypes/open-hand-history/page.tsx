import { OpenHandHistory } from "../../lib/OpenHandHistory";

const handHistory = buildHandHistory();

export default function TestOpenHand() {
  const hero = handHistory.players.find((player) => player.name === "Hero");
  const preflop = handHistory.rounds.find(
    (round) => round.street === "Preflop"
  );

  return (
    <div className="min-h-screen bg-zinc-950 py-16 text-zinc-50">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 rounded-3xl bg-zinc-900 p-10 shadow-2xl ring-1 ring-zinc-800">
        <section className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">
            OpenHand Tracker Demo
          </p>
          <h1 className="text-3xl font-semibold">
            {handHistory.site_name} · {handHistory.table_size}-Max Table
          </h1>
          <p className="text-zinc-400">
            Snapshot of a live session generated with{" "}
            <code className="rounded bg-zinc-800 px-2 py-1 text-sm text-emerald-300">
              open-hand-tracker
            </code>
            .
          </p>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
            <h2 className="text-sm uppercase tracking-wide text-zinc-400">
              Table
            </h2>
            <dl className="mt-3 space-y-2 text-lg">
              <div className="flex justify-between">
                <dt>Dealer Seat</dt>
                <dd className="font-semibold text-emerald-300">
                  {handHistory.dealer_seat}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>Blinds</dt>
                <dd className="font-semibold">
                  {handHistory.small_blind_amount}/
                  {handHistory.big_blind_amount}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>Ante</dt>
                <dd className="font-semibold">{handHistory.ante_amount}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
            <h2 className="text-sm uppercase tracking-wide text-zinc-400">
              Hero
            </h2>
            {hero ? (
              <dl className="mt-3 space-y-2 text-lg">
                <div className="flex justify-between">
                  <dt>Seat</dt>
                  <dd className="font-semibold">{hero.seat}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Stack</dt>
                  <dd className="font-semibold">{hero.starting_stack}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Cards</dt>
                  <dd className="font-semibold">
                    {hero.cards?.join(" ") ?? "??"}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-3 text-sm text-zinc-400">
                Hero record not found in this hand.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-black/40 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm uppercase tracking-wide text-zinc-400">
              Rounds
            </h2>
            <p className="text-xs text-zinc-500">
              {handHistory.rounds.length} tracked street
              {handHistory.rounds.length === 1 ? "" : "s"}
            </p>
          </div>
          {preflop ? (
            <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <p className="text-sm uppercase tracking-wide text-zinc-400">
                {preflop.street}
              </p>
              <p className="mt-2 text-base text-zinc-300">
                No actions captured for this round yet.
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-zinc-400">No rounds recorded.</p>
          )}
        </section>

        <section className="rounded-2xl border border-emerald-900/60 bg-emerald-950/40 p-5">
          <h2 className="text-sm uppercase tracking-wide text-emerald-300">
            Raw JSON
          </h2>
          <pre className="mt-3 max-h-[360px] overflow-auto text-sm text-emerald-100">
            {JSON.stringify(handHistory, null, 2)}
          </pre>
        </section>
      </main>
    </div>
  );
}

function buildHandHistory() {
  const ohh = new OpenHandHistory({
    siteName: "Live 8-Max",
    tableSize: 8,
    dealerSeat: 6,
    bigBlindAmount: 5,
    smallBlindAmount: 2,
  });

  // ohh.addPlayer({
  //   name: "Hero",
  //   id: 1,
  //   starting_stack: 1500,
  //   seat: 6,
  //   cards: ["Ah", "Ad"],
  // });

  // ohh.addRound({ id: 1, street: "Preflop", actions: [] });

  return ohh.toJSON().ohh;
}
