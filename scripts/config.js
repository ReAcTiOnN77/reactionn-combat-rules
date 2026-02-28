import {
  FlankingSettings,
  SurroundedSettings,
  ElevationSettings,
  ConditionsSettings,
  AmmoSettings,
} from "./settings-app.js";

export const MODULE_ID = "reactionn-combat-rules";

export const SETTING_KEYS = [
  "enableFlanking", "flankingBehaviour", "flankingRequiresActive",
  "enableSurrounded", "surroundedBehaviour",
  "enableHighGround", "highGroundBehaviour",
  "enableLowGround", "lowGroundBehaviour",
  "enableConditionAdvantage",
  "enableAmmoTracking", "recoverMagicalAmmo",
];

export function registerSettings() {

  /* ============================================== */
  /*  Menu: Flanking                                */
  /* ============================================== */

  game.settings.registerMenu(MODULE_ID, "flankingMenu", {
    name: "RCR.Settings.Flanking.Menu.Name",
    label: "RCR.Settings.Flanking.Menu.Label",
    hint: "RCR.Settings.Flanking.Menu.Hint",
    icon: "fa-solid fa-people-arrows",
    type: FlankingSettings,
    restricted: true,
  });

  game.settings.register(MODULE_ID, "enableFlanking", {
    name: "RCR.Settings.EnableFlanking.Name",
    scope: "world", config: false, type: Boolean, default: true,
  });

  game.settings.register(MODULE_ID, "flankingBehaviour", {
    name: "RCR.Settings.FlankingBehaviour.Name",
    scope: "world", config: false, type: String, default: "plus2",
  });

  game.settings.register(MODULE_ID, "flankingRequiresActive", {
    name: "RCR.Settings.FlankingRequiresActive.Name",
    scope: "world", config: false, type: Boolean, default: true,
  });

  /* ============================================== */
  /*  Menu: Surrounded                              */
  /* ============================================== */

  game.settings.registerMenu(MODULE_ID, "surroundedMenu", {
    name: "RCR.Settings.Surrounded.Menu.Name",
    label: "RCR.Settings.Surrounded.Menu.Label",
    hint: "RCR.Settings.Surrounded.Menu.Hint",
    icon: "fa-solid fa-arrows-to-circle",
    type: SurroundedSettings,
    restricted: true,
  });

  game.settings.register(MODULE_ID, "enableSurrounded", {
    name: "RCR.Settings.EnableSurrounded.Name",
    scope: "world", config: false, type: Boolean, default: true,
  });

  game.settings.register(MODULE_ID, "surroundedBehaviour", {
    name: "RCR.Settings.SurroundedBehaviour.Name",
    scope: "world", config: false, type: String, default: "advantage",
  });

  /* ============================================== */
  /*  Menu: Elevation                               */
  /* ============================================== */

  game.settings.registerMenu(MODULE_ID, "elevationMenu", {
    name: "RCR.Settings.Elevation.Menu.Name",
    label: "RCR.Settings.Elevation.Menu.Label",
    hint: "RCR.Settings.Elevation.Menu.Hint",
    icon: "fa-solid fa-mountain",
    type: ElevationSettings,
    restricted: true,
  });

  game.settings.register(MODULE_ID, "enableHighGround", {
    name: "RCR.Settings.EnableHighGround.Name",
    scope: "world", config: false, type: Boolean, default: true,
  });

  game.settings.register(MODULE_ID, "highGroundBehaviour", {
    name: "RCR.Settings.HighGroundBehaviour.Name",
    scope: "world", config: false, type: String, default: "plus2",
  });

  game.settings.register(MODULE_ID, "enableLowGround", {
    name: "RCR.Settings.EnableLowGround.Name",
    scope: "world", config: false, type: Boolean, default: false,
  });

  game.settings.register(MODULE_ID, "lowGroundBehaviour", {
    name: "RCR.Settings.LowGroundBehaviour.Name",
    scope: "world", config: false, type: String, default: "minus2",
  });

  /* ============================================== */
  /*  Menu: Conditions                              */
  /* ============================================== */

  game.settings.registerMenu(MODULE_ID, "conditionsMenu", {
    name: "RCR.Settings.Conditions.Menu.Name",
    label: "RCR.Settings.Conditions.Menu.Label",
    hint: "RCR.Settings.Conditions.Menu.Hint",
    icon: "fa-solid fa-bolt",
    type: ConditionsSettings,
    restricted: true,
  });

  game.settings.register(MODULE_ID, "enableConditionAdvantage", {
    name: "RCR.Settings.EnableConditionAdvantage.Name",
    scope: "world", config: false, type: Boolean, default: true,
  });

  /* ============================================== */
  /*  Menu: Ammo Tracking                           */
  /* ============================================== */

  game.settings.registerMenu(MODULE_ID, "ammoMenu", {
    name: "RCR.Settings.Ammo.Menu.Name",
    label: "RCR.Settings.Ammo.Menu.Label",
    hint: "RCR.Settings.Ammo.Menu.Hint",
    icon: "fa-solid fa-bow-arrow",
    type: AmmoSettings,
    restricted: true,
  });

  game.settings.register(MODULE_ID, "enableAmmoTracking", {
    name: "RCR.Settings.EnableAmmoTracking.Name",
    scope: "world", config: false, type: Boolean, default: true,
  });

  game.settings.register(MODULE_ID, "recoverMagicalAmmo", {
    name: "RCR.Settings.RecoverMagicalAmmo.Name",
    scope: "world", config: false, type: Boolean, default: false,
  });
}

export function getSetting(key) {
  return game.settings.get(MODULE_ID, key);
}
