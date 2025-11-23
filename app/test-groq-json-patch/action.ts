"use server";

import { generateObject } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { z } from "zod";

// Initialize Groq provider
const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

// Define the schema for RFC 6902 Patch operations
// We need a loose schema because value can be anything
const patchSchema = z.object({
  patches: z.array(
    z.object({
      op: z.enum(["add", "remove", "replace", "move", "copy", "test"]),
      path: z.string(),
      value: z.any().optional(),
      from: z.string().optional(), // only for move/copy
    })
  ),
});

export async function generateHandHistoryPatch(
  userInput: string,
  currentStateContext: any
) {
  try {
    const { object } = await generateObject({
      model: groq("openai/gpt-oss-20b"),
      mode: "json",
      schema: patchSchema,
      system: `
        You are a Poker Hand History Assistant.
        Your goal is to interpret natural language commands from a user describing a poker game state and return a strictly valid RFC 6902 JSON Patch array to update the game state.

        The game state follows this structure (OpenHandHistory):
        {
          table_size: number;
          dealer_seat: number;
          hero_player_id: number;
          small_blind_amount: number;
          big_blind_amount: number;
          players: Array<{
            id: number,
            name: string,
            seat: number,
            starting_stack: number,
            cards?: string[]
          }>;
          rounds: Array<Round>;
          ...
        }

        Rules:
        1. Seat numbering is 1-indexed.
        2. Default Positioning Assumption (unless specific seats are given):
           - Assume the Button (Dealer) is at the LAST seat (Seat = table_size).
           - Assume Small Blind is Seat 1.
           - Assume Big Blind is Seat 2.
           
           Mapping by Table Size:
           - 9-handed: SB=1, BB=2, UTG=3, UTG+1=4, UTG+2=5, LJ=6, HJ=7, CO=8, Button=9
           - 8-handed: SB=1, BB=2, UTG=3, UTG+1=4, LJ=5, HJ=6, CO=7, Button=8
           - 6-handed: SB=1, BB=2, UTG=3, MP=4, CO=5, Button=6
           - Heads-up (2-handed): Button/SB=1, BB=2 (Exception: Button acts first preflop).

        3. If the user says "I am [Position]" (e.g. "I'm UTG"):
           - Ensure 'table_size' is set (default to 8 if unknown).
           - Set 'dealer_seat' to equal 'table_size' (so the button is the last seat).
           - Ensure a player with 'hero_player_id' exists.
           - Place that player in the specific seat mapped above (e.g. if UTG, Seat 3).
        
        4. Card Format: Always use Uppercase Rank + Lowercase Suit (e.g., "As", "Ah", "Kd", "Tc").
        
        5. Stakes and Game Type:
           - If user says "two five" or "2/5", set small_blind_amount=2, big_blind_amount=5.
           - If user says "one two" or "1/2", set small_blind_amount=1, big_blind_amount=2.
           - If user says "six max" or "6 max", set table_size=6.
           - If user says "nine handed" or "9 handed", set table_size=9.

        6. Patch Strategy:
           - If the player already exists, prefer "replace" operations on their fields.
           - Only use "add" for new players.
        
        7. Terminology & Aggression:
           - "3-bet": This is a re-raise. 
             - Pre-flop: Open raise -> 3-bet. 
             - Post-flop: Bet -> Raise -> 3-bet.
           - If a player "3-bets", find the current active bet amount and increase it substantially (or to the specified amount).
           - "Hero": Refers to the player with 'hero_player_id'.

        8. Output ONLY the JSON patch array wrapped in the 'patches' object.
      `,
      prompt: `
        Current State Context: ${JSON.stringify(currentStateContext)}
        
        User Command: "${userInput}"
      `,
    });

    return { success: true, patches: object.patches };
  } catch (error) {
    console.error("AI Generation failed:", error);
    return { success: false, error: "Failed to generate patch" };
  }
}
