// modules/reactionn-combat-rules/scripts/config.js

export const MODULE_ID = "reactionn-combat-rules";

const L = (key) => game.i18n.localize(key);

function behaviourChoices(prefix) {
  return {
    advantage: L(`${prefix}.Advantage`),
    plus1:     L(`${prefix}.Plus1`),
    plus2:     L(`${prefix}.Plus2`),
    plus3:     L(`${prefix}.Plus3`),
    plus4:     L(`${prefix}.Plus4`),
    plus5:     L(`${prefix}.Plus5`),
  };
}

export function registerSettings() {
  game.settings.register(MODULE_ID, "enableFlanking", {
    name: L("RCR.Settings.EnableFlanking.Name"),
    hint: L("RCR.Settings.EnableFlanking.Hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register(MODULE_ID, "flankingBehaviour", {
    name: L("RCR.Settings.FlankingBehaviour.Name"),
    hint: L("RCR.Settings.FlankingBehaviour.Hint"),
    scope: "world",
    config: true,
    type: String,
    choices: behaviourChoices("RCR.Settings.FlankingBehaviour"),
    default: "plus2",
  });

  game.settings.register(MODULE_ID, "flankingRequiresActive", {
    name: L("RCR.Settings.FlankingRequiresActive.Name"),
    hint: L("RCR.Settings.FlankingRequiresActive.Hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register(MODULE_ID, "enableSurrounded", {
    name: L("RCR.Settings.EnableSurrounded.Name"),
    hint: L("RCR.Settings.EnableSurrounded.Hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register(MODULE_ID, "surroundedBehaviour", {
    name: L("RCR.Settings.SurroundedBehaviour.Name"),
    hint: L("RCR.Settings.SurroundedBehaviour.Hint"),
    scope: "world",
    config: true,
    type: String,
    choices: behaviourChoices("RCR.Settings.SurroundedBehaviour"),
    default: "advantage",
  });

  game.settings.register(MODULE_ID, "enableHighGround", {
    name: L("RCR.Settings.EnableHighGround.Name"),
    hint: L("RCR.Settings.EnableHighGround.Hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register(MODULE_ID, "highGroundBehaviour", {
    name: L("RCR.Settings.HighGroundBehaviour.Name"),
    hint: L("RCR.Settings.HighGroundBehaviour.Hint"),
    scope: "world",
    config: true,
    type: String,
    choices: behaviourChoices("RCR.Settings.HighGroundBehaviour"),
    default: "plus2",
  });

  game.settings.register(MODULE_ID, "enableConditionAdvantage", {
    name: L("RCR.Settings.EnableConditionAdvantage.Name"),
    hint: L("RCR.Settings.EnableConditionAdvantage.Hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });
}

export function getSetting(key) {
  return game.settings.get(MODULE_ID, key);
}
