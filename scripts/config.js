// modules/reactionn-combat-rules/scripts/config.js

export const MODULE_ID = "reactionn-combat-rules";

const L = (key) => game.i18n.localize(key);

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
    name: L("RCR.Settings.flankingBehaviour.Name"),
    hint: L("RCR.Settings.flankingBehaviour.Hint"),
    scope: "world",
    config: true,
    type: String,
    choices: {
      advantage:  L("RCR.Settings.flankingBehaviour.Adv"),
      plus1:      L("RCR.Settings.flankingBehaviour.Plus1"),
      plus2:      L("RCR.Settings.flankingBehaviour.Plus2"),
      plus3:      L("RCR.Settings.flankingBehaviour.Plus3"),
      plus4:      L("RCR.Settings.flankingBehaviour.Plus4"),
      plus5:      L("RCR.Settings.flankingBehaviour.Plus5"),
    },
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

  game.settings.register(MODULE_ID, "enableHighGround", {
    name: L("RCR.Settings.EnableHighGround.Name"),
    hint: L("RCR.Settings.EnableHighGround.Hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
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
