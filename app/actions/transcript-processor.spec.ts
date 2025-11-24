import { describe, it, expect } from "vitest";
import * as dotenv from "dotenv";
import { generateHandHistoryPatch } from "./generate-hand-history-patch";
import { OpenHandHistory } from "../lib/OpenHandHistory";
import { applyPatch, Operation } from "rfc6902";

dotenv.config({ path: ".env.local" });
dotenv.config();

// --- Test ---

describe("Transcript Processing Integration", () => {
  const TIMEOUT = 60000;

  it(
    "processes 'gun plus one' hand history correctly",
    async () => {
      const transcript = [
        "So I'm onto the gun plus one.",
        "I get dealt nine ten suited spades.",
        "And I raise to seven.",
        "So three and a half x the big blind. I get",
        "called by the button. The big",
        "blind who's been three betting a lot of three bets to about",
        "three or four x. Yeah. It's about 30.",
        "Me and the bottom both core. The flop comes 10 jack, queen.",
      ];

      const { state } = await processTranscript(transcript);

      const history = getActionHistory(state, "Preflop");

      // Filter for key voluntary actions
      const keyActions = history.filter(
        (action) =>
          action.includes("Raise") ||
          action.includes("Call") ||
          action.includes("Bet")
      );

      const expectedSequence = [
        "Hero: Raise",
        "Button: Call",
        "BB: Raise",
        "Hero: Call",
        "Button: Call",
      ];

      expect(keyActions).toEqual(expectedSequence);
    },
    TIMEOUT
  );
});

// --- Helpers ---

async function processTranscript(transcriptLines: string[]) {
  let state = new OpenHandHistory().toJSON().ohh;
  const transcriptHistory: string[] = [];
  const patchLog: any[] = [];

  for (const line of transcriptLines) {
    const result = await generateHandHistoryPatch(
      line,
      transcriptHistory,
      state
    );

    if (result.success && result.patches && result.patches.length > 0) {
      const newState = JSON.parse(JSON.stringify(state));
      applyPatch(newState, result.patches as Operation[]);
      state = newState;
      patchLog.push({ command: line, patches: result.patches });
    }
    transcriptHistory.push(line);
  }

  return { state, patchLog };
}

function getActionHistory(state: any, street: string): string[] {
  const round = state.rounds.find((r: any) => r.street === street);
  if (!round) return [];

  const heroId = state.hero_player_id;
  const dealerSeat = state.dealer_seat;

  const btnPlayer = state.players.find((p: any) => p.seat === dealerSeat);
  const btnId = btnPlayer ? btnPlayer.id : -1;

  let sbId = -1;
  let bbId = -1;
  round.actions.forEach((a: any) => {
    if (a.action === "Post SB") sbId = a.player_id;
    if (a.action === "Post BB") bbId = a.player_id;
  });

  return round.actions.map((a: any) => {
    let role = `Player ${a.player_id}`;
    if (a.player_id === heroId) role = "Hero";
    else if (a.player_id === btnId) role = "Button";
    else if (a.player_id === sbId) role = "SB";
    else if (a.player_id === bbId) role = "BB";

    return `${role}: ${a.action}`;
  });
}
