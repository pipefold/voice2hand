import { describe, it, expect } from "vitest";
import * as dotenv from "dotenv";
import { generateHandHistoryPatch } from "./generate-hand-history-patch";
import { OpenHandHistory } from "../lib/OpenHandHistory";
import { MOCK_TRANSCRIPTS, MockExpectations } from "../lib/mock-transcripts";
import { applyPatch, Operation } from "rfc6902";

dotenv.config({ path: ".env.local" });
dotenv.config();

const TIMEOUT = 60000; // 60s timeout for LLM calls

describe("Mock Transcript Verification", () => {
  for (const [key, scenario] of Object.entries(MOCK_TRANSCRIPTS)) {
    it(
      `should correctly parse the "${scenario.label}" scenario`,
      async () => {
        console.log(`\n🧪 Testing Scenario: ${scenario.label}`);
        let state = new OpenHandHistory().toJSON().ohh;
        const transcriptHistory: string[] = [];

        for (const line of scenario.lines) {
          console.log(`   > "${line}"`);
          const result = await generateHandHistoryPatch(
            line,
            transcriptHistory,
            state
          );

          if (!result.success) {
            throw new Error(`Failed at line: "${line}" - ${result.error}`);
          }

          if (result.patches && result.patches.length > 0) {
            const newState = JSON.parse(JSON.stringify(state));
            applyPatch(newState, result.patches as Operation[]);
            state = newState;
          }
          transcriptHistory.push(line);
        }

        // Verification
        const ex = scenario.expectations;
        console.log("   ✅ Transcript processed. Verifying expectations...");

        // Hero Cards
        if (ex.heroCards) {
          const hero = state.players.find(
            (p: any) => p.id === state.hero_player_id
          );
          expect(hero, "Hero should exist").toBeDefined();

          if (hero) {
            expect(hero.cards, "Hero should have cards").toBeDefined();

            const heroCards = hero.cards;
            if (heroCards) {
              // Check partial matches for ranks (e.g. "A" matches "As")
              ex.heroCards.forEach((expectedCard, idx) => {
                const actualCard = heroCards[idx];
                expect(actualCard).toBeDefined();
                if (expectedCard.length === 1) {
                  // Just rank check
                  expect(actualCard[0]).toBe(expectedCard);
                } else {
                  // Full match
                  expect(actualCard).toBe(expectedCard);
                }
              });
            }
          }
        }

        // Board Cards
        if (ex.boardCards) {
          // Find the last round that actually has cards (e.g. River, if Showdown is empty)
          const lastRoundWithCards = [...state.rounds]
            .reverse()
            .find((r: any) => r.cards && r.cards.length > 0);
          const board = lastRoundWithCards?.cards || [];

          ex.boardCards.forEach((expectedRank) => {
            const found = board.some((c: string) => c.startsWith(expectedRank));
            expect(found, `Board should contain ${expectedRank}`).toBe(true);
          });
        }

        // Final Street
        if (ex.finalStreet) {
          // "Showdown" isn't a street in OHH usually, it's implied by actions or state
          // checking last round street
          const lastRound = state.rounds[state.rounds.length - 1];
          if (ex.finalStreet === "Showdown") {
            // Accept either "River" (end of hand) or explicit "Showdown" street
            expect(["River", "Showdown"]).toContain(lastRound.street);
          } else {
            expect(lastRound.street).toBe(ex.finalStreet);
          }
        }
      },
      TIMEOUT
    );
  }
});
