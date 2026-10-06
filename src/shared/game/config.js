// Every rule number lives here so the tentative design can be tuned without touching logic.
// Values marked (Risk) come from classic Risk; (proposed) fill gaps in the Brisque brief;
// (brief) are as specified. See docs/GAME-DESIGN.md for the reasoning and open questions.

export const RULES = {
  // setup
  startTerritories: 4, // (proposed) dealt per player; the rest start empty so there is land to expand into
  startTroopsPerTerritory: 1, // (Risk)
  startInventory: { 2: 40, 3: 35, 4: 30, 5: 25, 6: 20 }, // (Risk) initial armies by player count

  // income at the start of each of your turns, counted on territories you hold with CERTAINTY
  minIncome: 3, // (Risk)
  territoriesPerTroop: 3, // (Risk)
  continentBonus: true, // (Risk) bonus from map.continents[].bonus when you certainly hold all of it

  // actions per turn
  maxDeployPerTurn: 10, // (brief) troops dropped from inventory per turn, total
  movesPerTurn: 5, // (proposed) classical moves/attacks per turn
  splitsPerTurn: 1, // (proposed) quantum split moves per turn
  allowBias: false, // splits are always 50/50; nesting gives 25 %, 12.5 %, ... (true: honour action.bias)
  mustLeaveOne: true, // (Risk) a move never empties its source; "stay put" is available as a split branch

  // battles: a territory holding two or more armies is contested, locked, and unresolved until measured
  battleExponent: 1, // (brief) P(victor) ∝ troops^exponent; 1 = proportional to troop count
  returnFraction: 1, // (brief) share of each loser's troops returned to inventory; <1 adds attrition
  victorAttrition: 0, // (proposed, off) share of the victor's troops lost in the battle

  // ordnance
  bombSlots: 5, // (brief)
  bombCooldown: 3, // (brief) own turns before a used slot is ready again
  bombCertainTargets: false, // (proposed) allow bombing a territory already certain (it would do nothing)

  // quantum budget
  maxWorlds: 64, // (proposed) cap on simultaneous branches; a split that would exceed it is refused
  maxParts: 512, // cap on distinct histories kept across all branches (merged worlds keep theirs)
  coherenceRounds: 3, // (proposed) a split thread older than this is measured automatically at round end
  contestRounds: 2, // (proposed) a contest older than this is measured automatically at round end

  // end
  roundLimit: 0, // (proposed, off) >0: after this many rounds the player with most certain territory wins
};

export const PLAYER_COLORS = ['#e05a47', '#3f7fd9', '#e3b43a', '#4fae6a', '#9a5fd0', '#e07fb0'];
