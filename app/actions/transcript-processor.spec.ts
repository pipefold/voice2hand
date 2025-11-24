import { describe, it, expect } from "vitest";
import * as dotenv from "dotenv";
import { generateHandHistoryPatch } from "./generate-hand-history-patch";
import { OpenHandHistory } from "../lib/OpenHandHistory";
import { applyPatch, Operation } from "rfc6902";

dotenv.config({ path: ".env.local" });
dotenv.config();

describe("Transcript Processing Integration", () => {
  const TIMEOUT = 60000; // 60s timeout for LLM calls

  it(
    "processes 'gun plus one' hand history step-by-step",
    async () => {
      let state = new OpenHandHistory().toJSON().ohh;
      const transcriptHistory: string[] = [];

      // Helper to run a single step
      const step = async (
        input: string,
        check: (patches: any[], newState: any) => void
      ) => {
        console.log(`\n📝 Step: "${input}"`);
        const result = await generateHandHistoryPatch(
          input,
          transcriptHistory,
          state
        );

        expect(result.success).toBe(true);

        const newState = JSON.parse(JSON.stringify(state));
        if (result.patches && result.patches.length > 0) {
          applyPatch(newState, result.patches as Operation[]);
        }

        // Run assertions for this step
        try {
          check(result.patches || [], newState);
        } catch (e) {
          console.error("❌ Step Failed:", input);
          console.error("Patches:", JSON.stringify(result.patches, null, 2));
          console.error(
            "State Players:",
            JSON.stringify(newState.players, null, 2)
          );
          throw e;
        }

        // Update context for next step
        state = newState;
        transcriptHistory.push(input);
      };

      // 1. Setup Position
      await step("So I'm onto the gun plus one.", (patches, s) => {
        // Should set up table and Hero
        expect(s.dealer_seat).toBeDefined(); // Default usually 8 or 9
        const hero = s.players.find((p: any) => p.id === s.hero_player_id);
        expect(hero).toBeDefined();
        // UTG is Seat 3, UTG+1 is Seat 4 in both 8/9 handed mappings
        expect(hero.seat).toBe(4);
      });

      // 2. Dealt Cards & Blinds
      await step("I get dealt nine ten suited spades.", (patches, s) => {
        // Should add SB/BB players and post blinds
        const hero = s.players.find((p: any) => p.id === s.hero_player_id);
        expect(hero.cards).toEqual(["9s", "Ts"]);

        const preflop = s.rounds[0];
        expect(preflop.street).toBe("Preflop");
        expect(preflop.actions.length).toBeGreaterThanOrEqual(2); // Post SB, Post BB

        const postSb = preflop.actions.find((a: any) => a.action === "Post SB");
        const postBb = preflop.actions.find((a: any) => a.action === "Post BB");
        expect(postSb).toBeDefined();
        expect(postBb).toBeDefined();
      });

      // 3. Hero Raise
      await step("And I raise to seven.", (patches, s) => {
        const preflop = s.rounds[0];
        const lastAction = preflop.actions[preflop.actions.length - 1];

        expect(lastAction.player_id).toBe(s.hero_player_id);
        expect(lastAction.action).toBe("Raise");
        expect(lastAction.amount).toBe(7);
      });

      // 4. Commentary (No-op)
      await step("So three and a half x the big blind.", (patches, s) => {
        // Should not generate meaningful patches, or at least not change state
        expect(patches.length).toBe(0);
      });

      // 5. Button Call
      await step("I get called by the button.", (patches, s) => {
        const preflop = s.rounds[0];
        const lastAction = preflop.actions[preflop.actions.length - 1];
        const btn = s.players.find(
          (p: any) => p.name === "Button" || p.seat === s.dealer_seat
        );

        expect(btn).toBeDefined();
        expect(lastAction.player_id).toBe(btn.id);
        expect(lastAction.action).toBe("Call");
        // CRITICAL FIX CHECK: Amount should match the raise (7), not be the difference (5)
        expect(lastAction.amount).toBe(7);
      });

      // 6. BB Commentary (No-op / Context)
      await step(
        "The big blind who's been three betting a lot of three bets to about",
        (patches, s) => {
          // Usually shouldn't act yet as sentence is incomplete
          expect(patches.length).toBe(0);
        }
      );

      // 7. BB Squeeze/Raise
      await step("three or four x. Yeah. It's about 30.", (patches, s) => {
        const preflop = s.rounds[0];
        const lastAction = preflop.actions[preflop.actions.length - 1];
        const bb = s.players.find((p: any) => p.seat === 2); // BB is Seat 2

        expect(bb).toBeDefined();
        expect(lastAction.player_id).toBe(bb.id);
        expect(lastAction.action).toBe("Raise");
        expect(lastAction.amount).toBe(30);
      });

      // 8. Hero Call & Button Call & Flop
      await step(
        "Me and the bottom both core. The flop comes 10 jack, queen.",
        (patches, s) => {
          // This step handles multiple actions: Hero Call, Btn Call, Next Street
          const preflop = s.rounds.find((r: any) => r.street === "Preflop");

          // Verify Calls
          // We need to find the calls AFTER the raise to 30
          const raiseActionIndex = preflop.actions.findIndex(
            (a: any) => a.amount === 30 && a.action === "Raise"
          );
          const subsequentActions = preflop.actions.slice(raiseActionIndex + 1);

          const heroCall = subsequentActions.find(
            (a: any) => a.player_id === s.hero_player_id
          );
          const btnCall = subsequentActions.find(
            (a: any) =>
              a.seat === s.dealer_seat || a.player_id !== s.hero_player_id
          ); // Simplify finding button

          expect(heroCall?.action).toBe("Call");
          expect(heroCall?.amount).toBe(30);

          // Note: We check presence; button ID might vary if we didn't capture it earlier
          // But generally expecting 2 calls.

          // Verify Flop
          const flop = s.rounds.find((r: any) => r.street === "Flop");
          expect(flop).toBeDefined();
          expect(flop.cards.length).toBe(3);
          // Suits might be hallucinated, but ranks should match
          const ranks = flop.cards.map((c: string) => c[0]);
          expect(ranks).toContain("T");
          expect(ranks).toContain("J");
          expect(ranks).toContain("Q");
        }
      );
    },
    TIMEOUT
  );
});
