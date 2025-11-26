export interface MockExpectations {
  heroSeat?: number;
  heroCards?: string[]; // e.g. ["As", "Kh"]
  boardCards?: string[]; // Just the ranks, e.g. ["T", "J", "Q"]
  finalStreet?: "Preflop" | "Flop" | "Turn" | "River" | "Showdown";
  minPotSize?: number;
}

export const MOCK_TRANSCRIPT_STANDARD = [
  "So I'm onto the gun plus one.",
  "I get dealt nine ten suited spades.",
  "And I raise to seven.",
  "So three and a half x the big blind.",
  "I get called by the button.",
  "The big blind who's been three betting a lot of three bets to about",
  "three or four x. Yeah. It's about 30.",
  "Me and the bottom both core. The flop comes 10 of hearts, jack of diamonds, queen of clubs.",
  "Big blind bets 30. I call. Button folds.",
  "Turn is the 8 of spades.",
  "Big blind checks. I bet 60. He calls.",
  "River is the Jack of spades.",
  "He checks. I bet 150. He folds.",
];

export const MOCK_TRANSCRIPT_HU_FOLD_TURN = [
  "I'm in the cutoff with Ace King offsuit.",
  "Folded to me, I make it 15.",
  "Big blind calls.",
  "Flop comes Ace, seven, deuce rainbow.",
  "He checks, I bet 10. He calls.",
  "Turn is a King. He checks again.",
  "I bet 30. He folds.",
];

export const MOCK_TRANSCRIPT_MULTIWAY_ALLIN = [
  "UTG opens to 10. UTG plus one calls.",
  "I'm on the button with pocket sevens and I call.",
  "Big blind calls too. Four ways to the flop.",
  "Flop is seven, eight, nine, two hearts.",
  "Checks to UTG who bets 25. UTG plus one calls.",
  "I raise to 85. Big blind folds.",
  "UTG calls. UTG plus one folds.",
  "Heads up to the turn. Turn is the Jack of hearts.",
  "UTG checks. I bet 150.",
  "UTG check-raises all-in for 400 total. I call.",
  "River is the two of clubs.",
  "He shows Ace King of hearts for the nut flush. I lose.",
];

export const MOCK_TRANSCRIPTS: Record<
  string,
  { label: string; lines: string[]; expectations: MockExpectations }
> = {
  standard: {
    label: "Standard (3-Bet Pot)",
    lines: MOCK_TRANSCRIPT_STANDARD,
    expectations: {
      heroCards: ["9s", "Ts"],
      boardCards: ["T", "J", "Q", "8", "J"],
      finalStreet: "River",
    },
  },
  hu_fold_turn: {
    label: "Heads-Up (Fold Turn)",
    lines: MOCK_TRANSCRIPT_HU_FOLD_TURN,
    expectations: {
      heroCards: ["A", "K"], // Partial match OK?
      boardCards: ["A", "7", "2", "K"],
      finalStreet: "Turn",
    },
  },
  multiway_allin: {
    label: "Multi-Way All-In",
    lines: MOCK_TRANSCRIPT_MULTIWAY_ALLIN,
    expectations: {
      heroCards: ["7", "7"],
      boardCards: ["7", "8", "9", "J", "2"],
      finalStreet: "Showdown", // or River
    },
  },
};
