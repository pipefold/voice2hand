import { OHHData, Action, Round } from "./OpenHandHistory";

export interface Cursor {
  roundIdx: number;
  actionIdx: number; // -1 indicates start of round (cards dealt, previous bets gathered)
}

export interface PlayerState {
  id: number;
  name: string;
  seat: number;
  initialStack: number;
  currentStack: number;
  currentWager: number; // Chips in front of player this street
  isFolded: boolean;
  holeCards: string[] | null; // Null if not known or folded (though replayer usually shows known cards)
  isActive: boolean; // Is it their turn to act NEXT?
  lastAction: string | null; // e.g. "Check", "Bet 50" - for display bubbles
}

export interface TableState {
  pot: number;
  communityCards: string[];
  players: PlayerState[];
  currentStreetName: string;
  dealerSeat: number;
  activePlayerId: number | null; // ID of player who acts NEXT
}

export function calculateGameState(
  history: OHHData,
  cursor: Cursor
): TableState {
  // 1. Initialize State
  const playersMap = new Map<number, PlayerState>();

  history.players.forEach((p) => {
    playersMap.set(p.id, {
      id: p.id,
      name: p.name,
      seat: p.seat,
      initialStack: p.starting_stack,
      currentStack: p.starting_stack,
      currentWager: 0,
      isFolded: false,
      holeCards: p.cards || null,
      isActive: false,
      lastAction: null,
    });
  });

  let pot = 0;
  let communityCards: string[] = [];

  // 2. Helper to process a single action
  const applyAction = (action: Action) => {
    const player = playersMap.get(action.player_id);
    if (!player) return;

    player.lastAction = action.action;

    switch (action.action) {
      case "Post SB":
      case "Post BB":
      case "Bet":
      case "Call":
      case "Raise":
        const amount = action.amount || 0;
        // In poker, "Raise" amount in OHH is usually the *total* bet,
        // but we need to deduct the *difference* from their stack.
        // However, usually OHH 'amount' is the raw amount for that specific action type.
        // Let's assume 'amount' is the absolute amount put in this action.
        // Wait, standard OHH logic:
        // If I bet 50, I put 50 in.
        // If I raise to 150, I put 100 more in (if I already bet 50).
        // BUT OHH 'amount' field definition is critical here.
        // Looking at typical parsers:
        // 'amount' is usually the *total* amount the player has put in *for this turn*?
        // Or the incremental amount?
        // The OpenHandHistory.ts calculator `calculateWinningAmount` treats it as incremental contribution
        // EXCEPT for "Raise"?
        // Let's look at `calculateWinningAmount`:
        // `totalCommitted += amount;`
        // It simply sums them up. This implies 'amount' is always the INCREMENTAL chips added to the pot.
        // e.g. If I Bet 10, amount=10. If I Raise to 30, amount=20 (the difference).
        // Let's assume INCREMENTAL for now as it simplifies the math (stack -= amount).

        if (amount > 0) {
          player.currentStack -= amount;
          player.currentWager += amount;
          if (action.action === "Raise" || action.action === "Bet") {
             player.lastAction = `${action.action} ${player.currentWager}`; // Display total wager
          } else {
             player.lastAction = action.action;
          }
        }
        break;

      case "Fold":
        player.isFolded = true;
        player.holeCards = null; // Muck cards
        break;

      case "Check":
        // No stack change
        break;
    }
  };

  // 3. Replay Loop
  for (let r = 0; r <= cursor.roundIdx; r++) {
    const round = history.rounds[r];
    if (!round) break; // Should not happen if cursor is valid

    // -- Start of Street Logic --
    // If we are processing a round that is fully completed (r < cursor.roundIdx),
    // OR we are at the current round.

    // Always sweep bets from PREVIOUS rounds into pot
    if (r > 0) {
       // We are at the start of round 'r'.
       // This logic actually needs to run at the END of round 'r-1'.
       // But since we iterate forward, we can run "Start of Street" logic here.
       
       // If this is the round we are targeting, we strictly follow the logic:
       // 1. Sweep previous street's wagers
       if (r === cursor.roundIdx && cursor.actionIdx === -1) {
         // We are EXACTLY at the start of this street.
         // We need to show the pot from previous streets, and the cards for this street.
       }
    }

    // To handle sweeping correctly:
    // We sweep at the beginning of every round loop EXCEPT the first one (Preflop).
    if (r > 0) {
      playersMap.forEach((p) => {
        pot += p.currentWager;
        p.currentWager = 0;
        p.lastAction = null; // Reset bubbles on new street
      });
      
      // Deal Community Cards for this round
      // Note: Round 0 is Preflop (no community cards usually, or they appear at R1/Flop)
      if (round.cards) {
         communityCards = [...communityCards, ...round.cards];
      }
    } else {
       // Round 0 (Preflop)
       // Usually no community cards.
       // No pot sweep (pot starts at 0).
    }

    // -- Action Loop --
    const roundActions = round.actions || [];
    const actionLimit = (r === cursor.roundIdx) ? cursor.actionIdx : roundActions.length - 1;

    // If cursor.actionIdx is -1, we don't run any actions for this round.
    // We just did the "Start of Street" logic above.
    
    for (let i = 0; i <= actionLimit; i++) {
      const action = roundActions[i];
      if (action) applyAction(action);
    }
  }

  // 4. Determine Next Active Player
  // If we are at the end of the actions list, who is next?
  // Or if we are at action N, the state reflects "After Action N".
  // The UI usually wants to highlight who is acting *next*.
  
  // If we are NOT at the very end of the entire history, we can peek ahead.
  let activePlayerId: number | null = null;
  
  // Logic to find next actor:
  // 1. Is there a next action in this round?
  const currentRound = history.rounds[cursor.roundIdx];
  const currentRoundActions = currentRound?.actions || [];

  if (currentRound && cursor.actionIdx < currentRoundActions.length - 1) {
     const nextAction = currentRoundActions[cursor.actionIdx + 1];
     if (nextAction) activePlayerId = nextAction.player_id;
  } 
  // 2. If not, is there a next round?
  else if (cursor.roundIdx < history.rounds.length - 1) {
     // The next "step" is actually dealing the next street (actionIdx -1 of next round).
     // Usually no player is "active" during the deal animation.
     activePlayerId = null; 
  }

  // Convert Map to Array
  const players = Array.from(playersMap.values()).sort((a, b) => a.seat - b.seat);

  // Determine Street Name
  const currentStreetName = history.rounds[cursor.roundIdx]?.street || "Preflop";

  return {
    pot,
    communityCards: Array.from(new Set(communityCards)), // Dedup just in case
    players,
    currentStreetName,
    dealerSeat: history.dealer_seat,
    activePlayerId
  };
}

export function getNextCursor(history: OHHData, cursor: Cursor): Cursor | null {
    const { roundIdx, actionIdx } = cursor;
    const round = history.rounds[roundIdx];

    // 1. Can we advance in current round?
    const actions = round?.actions || [];
    if (round && actionIdx < actions.length - 1) {
        return { roundIdx, actionIdx: actionIdx + 1 };
    }

    // 2. Can we move to next round?
    if (roundIdx < history.rounds.length - 1) {
        return { roundIdx: roundIdx + 1, actionIdx: -1 }; // Start of next street
    }

    // End of history
    return null;
}

export function getPrevCursor(history: OHHData, cursor: Cursor): Cursor | null {
    const { roundIdx, actionIdx } = cursor;

    // 1. Can we go back in current round?
    if (actionIdx > -1) {
        return { roundIdx, actionIdx: actionIdx - 1 };
    }

    // 2. Can we go back to previous round?
    if (roundIdx > 0) {
        const prevRound = history.rounds[roundIdx - 1];
        const prevActions = prevRound?.actions || [];
        // Go to last action of previous round
        return { roundIdx: roundIdx - 1, actionIdx: prevActions.length - 1 };
    }

    // Start of history
    return null;
}
