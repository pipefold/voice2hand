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
  previousTranscript: string[],
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
          rounds: Array<{
            id: number;
            cards?: string[];
            street: "Preflop" | "Flop" | "Turn" | "River" | "Showdown";
            actions: Array<{
              action_number: number;
              player_id: number;
              action: "Dealt Card" | "Post SB" | "Post BB" | "Fold" | "Check" | "Bet" | "Raise" | "Call";
              amount?: number;
              is_allin?: boolean;
            }>;
          }>;
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
           - Extrapolate other table sizes beyond these examples.

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
           - Extrapolate other table sizes and stakes beyond these examples.

        6. Patch Strategy:
           - If the player already exists, prefer "replace" operations on their fields.
           - If a round for a street already exists (e.g. "Preflop"), prefer "replace" operations on that round's fields or "add" to its "actions" array.
           - If a round for the street DOES NOT exist (e.g. moving to "Flop"), use "add" to append to the "/rounds/-" path.
           - CRITICAL: NEVER "replace" or "add" the root "/rounds" array itself if rounds already exist. Always append or modify specific indices.
           - Only use "add" for new players or new rounds.
        
        7. Terminology:
           - "Hero": Refers to the player with 'hero_player_id'.
           - "Completes": Specifically refers to the Small Blind calling the difference to match the Big Blind amount pre-flop. Treat this as a "Call" action.
           - "3-bet" = a re-raise following a raise following an opening bet
             - pre-flop: the big blind or straddle is considered the first bet; confusingly the first raise is considered an "open(ing)" raise, so a 3-bet is a re-raise of an opening raise
             - post-flop: a bet followed by a raise followed by a re-raise is considered a 3-bet
           - "4-bet" = a re-raise following a 3-bet
           - "Limp": A call of the big blind amount pre-flop.

        8. Output ONLY the JSON patch array wrapped in the 'patches' object.

        9. Transcription Corrections:
           - "an eye check" / "an eye" -> Interpret as "and I check" / "and I".
           - "core" / "called" / "calls" -> Interpret "core" as "Call" (common ASR error).
           - "bottom" -> Interpret as "Button".
           - "gun" / "under the gun" -> Interpret as "UTG".

        10. Narrative Handling:
           - If the user describes a player's action with narrative phrasing like "who has been X-ing... to about Y" (e.g. "The BB who's been 3-betting to 30"), interpret this as the player performing action X to amount Y in the current game state.
           - "Me and the bottom both core" -> "Hero calls, Button calls".

        11. Incomplete Sentences / Trailing Subjects:
           - If a transcript segment ends with a player name or partial phrase without an action (e.g. "The big", "And then the"), DO NOT hallucinate an action for them.
           - Wait for the next segment to provide the action.
           - It is better to produce NO patches for an ambiguous segment than to guess wrong.

        12. Implicit Folds / Skipped Players:
           - If the action skips over a player who has cards (e.g. UTG raises, then Button calls), assume the intervening players (MP, CO) FOLDED.
           - If a player is not mentioned in a calling sequence closing the action (e.g. "Me and button call" -> SB and BB are not mentioned), do NOT generate Call actions for them.
           - Only generate actions for players explicitly mentioned or implied by "everyone calls".

        13. Multi-Step & Street Transition Logic:
           - If a user input contains actions for the current street AND announces the next street (e.g., "Me and button call. Flop is..."), you MUST:
             1. First, generate "add" patches for the missing actions (Calls) in the CURRENT round (Preflop).
             2. THEN, generate "add" patches for the NEW round (Flop).
           - Do NOT skip the intermediate actions.
           - Do NOT put pre-flop actions into the Flop round.

        11. Stack Sizes:
           - If the user does not specify a stack size for a player, assume the starting stack is 100BBs (100 * big_blind_amount).

        11. Pre-flop Blind Posting:
           - The "Preflop" round MUST start with the posting of blinds.
           - Action 1: "Post SB" (Small Blind) by the player in the SB seat.
           - Action 2: "Post BB" (Big Blind) by the player in the BB seat.
           - Only generate these actions if the user is describing a valid game setup or game action (e.g. "I was dealt Aces", "UTG raises"). 
           - If the user input is conversational (e.g. "testing", "can you hear me") and NOT a game action, DO NOT generate blind posting actions. Return an empty patch array.

        12. Corrections and Out-of-Order Info (CRITICAL):
            - If the user provides information that contradicts or precedes recorded actions (e.g. "There were 3 limpers" after previously recording "I check"), you MUST correct the history.
            - You cannot simply append actions if they belong earlier in the timeline.
            - Use "remove" operations to delete incorrect actions or actions that need to be moved.
            - Use "add" operations (with specific array indices like "/rounds/0/actions/2") to insert actions in the correct chronological order.
            - Example: If BB Checked (Action 3), but then user says "UTG called", you must insert the UTG Call at Action 3, and shift the BB Check to Action 4 (or remove and re-add it).
        
        13. Commentary / No-Op:
            - If the user's input is commentary (e.g. "bad beat", "that's crazy") or describes state that is ALREADY recorded (e.g. "it's a rainbow flop" when the flop cards are already different suits), DO NOT generate patches that duplicate data.
            - Return an empty 'patches' array: []
            - Do not fail; just return empty patches.
      `,
      prompt: `
        Current State Context: ${JSON.stringify(currentStateContext)}
        
        Previous Transcript Segments:
        ${JSON.stringify(previousTranscript)}

        Latest Transcript Segment: "${userInput}"
      `,
    });

    return { success: true, patches: object.patches };
  } catch (error) {
    console.error("AI Generation failed:", error);
    return { success: false, error: "Failed to generate patch" };
  }
}

