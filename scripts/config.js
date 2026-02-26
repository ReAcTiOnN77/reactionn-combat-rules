// modules/reactionn-combat-rules/scripts/config.js

export const MODULE_ID = "reactionn-combat-rules";

export function registerSettings() {
  game.settings.register(MODULE_ID, "enableFlanking", {
    name: "Enable Flanking",
    hint: "Melee attackers cardinally adjacent with an ally on the opposite side get +2 to hit.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register(MODULE_ID, "flankingRequiresActive", {
    name: "Flanking Requires Active Ally",
    hint: "If enabled, the ally on the opposite side must not be prone, incapacitated, unconscious, petrified, stunned, or paralyzed.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register(MODULE_ID, "enableSurrounded", {
    name: "Enable Surrounded",
    hint: "Melee attackers gain advantage when all 4 cardinal sides of the target are blocked by enemies or walls.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register(MODULE_ID, "enableHighGround", {
    name: "Enable High Ground",
    hint: "Ranged weapon and spell attacks get +2 when the attacker is at least 10 ft higher in elevation than the target.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register(MODULE_ID, "enableConditionAdvantage", {
    name: "Condition-Based Advantage/Disadvantage",
    hint: "Automatically apply advantage or disadvantage from conditions (e.g. blinded, restrained, prone, invisible, poisoned, paralyzed, stunned, unconscious).",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });
}

export function getSetting(key) {
  return game.settings.get(MODULE_ID, key);
}