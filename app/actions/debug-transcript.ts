import * as dotenv from "dotenv";
import { generateHandHistoryPatch } from "./generate-hand-history-patch";
import { OpenHandHistory } from "../lib/OpenHandHistory";
import { applyPatch, Operation } from "rfc6902";
import util from "util";

dotenv.config({ path: ".env.local" });
dotenv.config();

const TRANSCRIPT = [
  "So I'm onto the gun plus one.",
  "I get dealt nine ten suited spades.",
  "And I raise to seven.",
  "So three and a half x the big blind.",
  "I get called by the button.",
  "The big blind who's been three betting a lot of three bets to about",
  "three or four x. Yeah. It's about 30.",
  "Me and the bottom both core. The flop comes 10 jack, queen.",
];

async function debugTranscript() {
  console.log("🚀 Starting Transcript Debugger...\n");

  let state = new OpenHandHistory().toJSON().ohh;
  const transcriptHistory: string[] = [];

  for (const line of TRANSCRIPT) {
    console.log("---------------------------------------------------");
    console.log(`📝 INPUT: "${line}"`);

    try {
      const result = await generateHandHistoryPatch(
        line,
        transcriptHistory,
        state
      );

      if (!result.success) {
        console.log("❌ FAILED:", result.error);
        continue;
      }

      if (!result.patches || result.patches.length === 0) {
        console.log("⚪ NO PATCHES GENERATED");
      } else {
        console.log("🔧 PATCHES:");
        console.log(util.inspect(result.patches, { colors: true, depth: null }));

        const newState = JSON.parse(JSON.stringify(state));
        applyPatch(newState, result.patches as Operation[]);
        state = newState;

        console.log("\n📊 NEW STATE SUMMARY:");
        logStateSummary(state);
      }
    } catch (error) {
      console.error("💥 ERROR processing line:", error);
    }

    transcriptHistory.push(line);
    console.log("\n");
  }

  console.log("✅ Processing complete.");
}

function logStateSummary(state: any) {
  // Hero info
  console.log(`   Hero ID: ${state.hero_player_id}`);
  console.log(`   Dealer Seat: ${state.dealer_seat}`);

  // Last Round info
  if (state.rounds && state.rounds.length > 0) {
    const lastRound = state.rounds[state.rounds.length - 1];
    console.log(`   Current Street: ${lastRound.street}`);
    
    if (lastRound.cards && lastRound.cards.length > 0) {
      console.log(`   Board Cards: ${JSON.stringify(lastRound.cards)}`);
    }

    if (lastRound.actions && lastRound.actions.length > 0) {
      console.log("   Recent Actions:");
      // Show last 3 actions
      lastRound.actions.slice(-3).forEach((a: any) => {
        let actionStr = `     - P${a.player_id}: ${a.action}`;
        if (a.amount) actionStr += ` (${a.amount})`;
        console.log(actionStr);
      });
    }
  } else {
    console.log("   (No rounds started)");
  }
  
  // Players summary
  const players = state.players || [];
  if (players.length > 0) {
    console.log(`   Players (${players.length}): ${players.map((p: any) => `P${p.id}(Seat ${p.seat})`).join(", ")}`);
  }
}

debugTranscript();

