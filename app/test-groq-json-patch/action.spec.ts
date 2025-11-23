import { describe, it, expect } from "vitest";
import * as dotenv from "dotenv";
import { generateHandHistoryPatch } from "./action";
import { OpenHandHistory } from "../lib/OpenHandHistory";
import { applyPatch, Operation } from "rfc6902";

// Load environment variables
dotenv.config({ path: ".env.local" });
// Fallback to .env if .env.local doesn't exist or for CI
dotenv.config();

// Helper to run the flow
async function processCommand(command: string, initialState: any = null) {
  const state = initialState || new OpenHandHistory().toJSON().ohh;

  const context = {
    table_size: state.table_size,
    players: state.players,
    dealer_seat: state.dealer_seat,
    small_blind_amount: state.small_blind_amount,
    big_blind_amount: state.big_blind_amount,
  };

  const result = await generateHandHistoryPatch(command, context);

  if (!result.success || !result.patches) {
    throw new Error(
      `Failed to generate patch: ${result.error || "Unknown error"}`
    );
  }

  // Deep clone and apply
  const newState = JSON.parse(JSON.stringify(state));
  applyPatch(newState, result.patches as Operation[]);

  return newState;
}

describe("Groq Hand History Patching", () => {
  // Increase timeout for API calls (10s might be tight for some LLMs, using 15s)
  const TIMEOUT = 15000;

  it(
    "should set up an 8-handed game with Hero UTG",
    async () => {
      const state = await processCommand("8 handed game and I am UTG");

      expect(state.table_size).toBe(8);
      // UTG in 8-handed should be Seat 3 (SB=1, BB=2)
      const hero = state.players.find(
        (p: any) => p.id === state.hero_player_id
      );
      expect(hero).toBeDefined();
      expect(hero.seat).toBe(3);
    },
    TIMEOUT
  );

  it(
    "should handle heads-up positioning correctly",
    async () => {
      const state = await processCommand("Heads up match I'm in the big blind");

      expect(state.table_size).toBe(2);
      const hero = state.players.find(
        (p: any) => p.id === state.hero_player_id
      );
      expect(hero).toBeDefined();
      expect(hero.seat).toBe(2); // BB is Seat 2 in HU
    },
    TIMEOUT
  );

  it(
    "should deal cards correctly",
    async () => {
      // First setup hero
      let state = await processCommand("I'm on the button");
      // Then deal cards
      state = await processCommand("I have pocket aces", state);

      const hero = state.players.find(
        (p: any) => p.id === state.hero_player_id
      );
      expect(hero).toBeDefined();
      expect(hero.cards).toBeDefined();
      expect(hero.cards).toHaveLength(2);
      // Check that cards contain 'A'
      expect(hero.cards[0]).toMatch(/^A[shdc]$/);
      expect(hero.cards[1]).toMatch(/^A[shdc]$/);
    },
    TIMEOUT
  );

  it(
    "should default to 8-handed if unspecified",
    async () => {
      const state = await processCommand("I'm in the cutoff");

      expect(state.table_size).toBe(8);
      // Cutoff in 8-handed is Seat 7 (Button=8)
      const hero = state.players.find(
        (p: any) => p.id === state.hero_player_id
      );
      expect(hero).toBeDefined();
      expect(hero.seat).toBe(7);
    },
    TIMEOUT
  );

  it(
    "should update stakes based on natural language",
    async () => {
      const state = await processCommand(
        "Okay. So we're playing two five six max cash."
      );

      expect(state.table_size).toBe(6);
      expect(state.small_blind_amount).toBe(2);
      expect(state.big_blind_amount).toBe(5);
    },
    TIMEOUT
  );

  it(
    "should default player stack sizes to 100BB if unspecified",
    async () => {
      // Default blinds are 1/2, so 100BB = 200
      const state = await processCommand("I'm UTG");

      const hero = state.players.find(
        (p: any) => p.id === state.hero_player_id
      );

      expect(hero).toBeDefined();
      expect(hero.starting_stack).toBe(200);
    },
    TIMEOUT
  );
});
