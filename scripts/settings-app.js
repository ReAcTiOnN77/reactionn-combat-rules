const MODULE_ID = "reactionn-combat-rules";

const L = (key) => game.i18n.localize(key);
const getSetting = (key) => game.settings.get(MODULE_ID, key);

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/* -------------------------------------------------- */
/*  Shared dropdown options                            */
/* -------------------------------------------------- */

function advChoices() {
  return {
    advantage: L("RCR.Settings.Behaviour.Advantage"),
    plus1: L("RCR.Settings.Behaviour.Plus1"),
    plus2: L("RCR.Settings.Behaviour.Plus2"),
    plus3: L("RCR.Settings.Behaviour.Plus3"),
    plus4: L("RCR.Settings.Behaviour.Plus4"),
    plus5: L("RCR.Settings.Behaviour.Plus5"),
  };
}

function disadvChoices() {
  return {
    disadvantage: L("RCR.Settings.Behaviour.Disadvantage"),
    minus1: L("RCR.Settings.Behaviour.Minus1"),
    minus2: L("RCR.Settings.Behaviour.Minus2"),
    minus3: L("RCR.Settings.Behaviour.Minus3"),
    minus4: L("RCR.Settings.Behaviour.Minus4"),
    minus5: L("RCR.Settings.Behaviour.Minus5"),
  };
}

/* -------------------------------------------------- */
/*  Base settings app                                  */
/* -------------------------------------------------- */

class RCRSettingsBase extends HandlebarsApplicationMixin(ApplicationV2) {

  static SETTING_KEYS = [];

  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS ?? {}, {
    tag: "form",
    classes: ["standard-form", "rcr-settings"],
    position: { width: 500 },
    window: {
      contentClasses: ["standard-form"],
    },
    form: {
      submitOnChange: false,
      closeOnSubmit: true,
      handler(event, form, formData) {
        return this.constructor._onSubmit(event, form, formData);
      },
    },
  }, { inplace: false });

  static PARTS = {
    config: { template: "" },
    footer: { template: "templates/generic/form-footer.hbs" },
  };

  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    context.buttons ??= [{ type: "submit", icon: "fa-solid fa-save", label: "Save Changes" }];

    if (partId === "footer") return context;

    for (const key of this.constructor.SETTING_KEYS) {
      context[key] = getSetting(key);
    }
    context.advChoices = advChoices();
    context.disadvChoices = disadvChoices();

    return context;
  }

  static async _onSubmit(event, form, formData) {
    event.preventDefault();
    const data = foundry.utils.expandObject(formData.object ?? {});
    for (const [key, value] of Object.entries(data)) {
      if (this.SETTING_KEYS.includes(key)) {
        await game.settings.set(MODULE_ID, key, value);
      }
    }
  }
}

/* -------------------------------------------------- */
/*  Per-rule settings apps                             */
/* -------------------------------------------------- */

export class FlankingSettings extends RCRSettingsBase {
  static SETTING_KEYS = ["enableFlanking", "flankingBehaviour", "flankingRequiresActive"];

  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    id: "rcr-settings-flanking",
    window: {
      title: "RCR.Settings.Flanking.Legend",
      icon: "fa-solid fa-people-arrows",
      contentClasses: ["standard-form"],
    },
  }, { inplace: false });

  static PARTS = {
    config: { template: `modules/${MODULE_ID}/templates/settings-flanking.hbs` },
    footer: { template: "templates/generic/form-footer.hbs" },
  };
}

/* -------------------------------------------------- */

export class SurroundedSettings extends RCRSettingsBase {
  static SETTING_KEYS = ["enableSurrounded", "surroundedBehaviour"];

  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    id: "rcr-settings-surrounded",
    window: {
      title: "RCR.Settings.Surrounded.Legend",
      icon: "fa-solid fa-arrows-to-circle",
      contentClasses: ["standard-form"],
    },
  }, { inplace: false });

  static PARTS = {
    config: { template: `modules/${MODULE_ID}/templates/settings-surrounded.hbs` },
    footer: { template: "templates/generic/form-footer.hbs" },
  };
}

/* -------------------------------------------------- */

export class ElevationSettings extends RCRSettingsBase {
  static SETTING_KEYS = ["enableHighGround", "highGroundBehaviour", "enableLowGround", "lowGroundBehaviour"];

  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    id: "rcr-settings-elevation",
    window: {
      title: "RCR.Settings.Elevation.Legend",
      icon: "fa-solid fa-mountain",
      contentClasses: ["standard-form"],
    },
  }, { inplace: false });

  static PARTS = {
    config: { template: `modules/${MODULE_ID}/templates/settings-elevation.hbs` },
    footer: { template: "templates/generic/form-footer.hbs" },
  };
}

/* -------------------------------------------------- */

export class ConditionsSettings extends RCRSettingsBase {
  static SETTING_KEYS = ["enableConditionAdvantage"];

  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    id: "rcr-settings-conditions",
    window: {
      title: "RCR.Settings.Conditions.Legend",
      icon: "fa-solid fa-bolt",
      contentClasses: ["standard-form"],
    },
  }, { inplace: false });

  static PARTS = {
    config: { template: `modules/${MODULE_ID}/templates/settings-conditions.hbs` },
    footer: { template: "templates/generic/form-footer.hbs" },
  };
}

/* -------------------------------------------------- */

export class AmmoSettings extends RCRSettingsBase {
  static SETTING_KEYS = ["enableAmmoTracking", "recoverMagicalAmmo"];

  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    id: "rcr-settings-ammo",
    window: {
      title: "RCR.Settings.Ammo.Legend",
      icon: "fa-solid fa-bow-arrow",
      contentClasses: ["standard-form"],
    },
  }, { inplace: false });

  static PARTS = {
    config: { template: `modules/${MODULE_ID}/templates/settings-ammo.hbs` },
    footer: { template: "templates/generic/form-footer.hbs" },
  };
}
