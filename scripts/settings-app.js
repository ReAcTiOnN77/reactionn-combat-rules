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

function daisyChainChoices() {
  return {
    off: L("RCR.Settings.DaisyChain.Off"),
    ally: L("RCR.Settings.DaisyChain.AllyOnly"),
    both: L("RCR.Settings.DaisyChain.Both"),
  };
}

function esc(str) {
  return String(str ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;");
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
    config: { template: `modules/${MODULE_ID}/templates/settings-app.hbs` },
    footer: { template: "templates/generic/form-footer.hbs" },
  };

  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    context.buttons ??= [{ type: "submit", icon: "fa-solid fa-save", label: "Save Changes" }];
    if (partId === "config") {
      context.formHtml = this._buildFormHtml();
    }
    return context;
  }

  _buildFormHtml() { return ""; }

  static async _onSubmit(event, form, formData) {
    event.preventDefault();
    const data = foundry.utils.expandObject(formData.object ?? {});
    for (const [key, value] of Object.entries(data)) {
      if (this.SETTING_KEYS.includes(key)) {
        await game.settings.set(MODULE_ID, key, value);
      }
    }
  }

  /* ---- HTML builders ---- */

  _i18nKey(settingKey) {
    return settingKey.charAt(0).toUpperCase() + settingKey.slice(1);
  }

  _checkbox(settingKey, value) {
    const key = this._i18nKey(settingKey);
    return `<div class="form-group">
      <label>${L(`RCR.Settings.${key}.Name`)}</label>
      <input type="checkbox" name="${esc(settingKey)}" ${value ? "checked" : ""}>
      <p class="hint">${L(`RCR.Settings.${key}.Hint`)}</p>
    </div>`;
  }

  _select(settingKey, choices, value) {
    const key = this._i18nKey(settingKey);
    const opts = Object.entries(choices).map(([k, lbl]) =>
      `<option value="${esc(k)}" ${k === value ? "selected" : ""}>${esc(lbl)}</option>`
    ).join("");
    return `<div class="form-group">
      <label>${L(`RCR.Settings.${key}.Name`)}</label>
      <select name="${esc(settingKey)}">${opts}</select>
      <p class="hint">${L(`RCR.Settings.${key}.Hint`)}</p>
    </div>`;
  }

  _hr() { return "<hr>"; }
}

/* -------------------------------------------------- */
/*  Flanking                                           */
/* -------------------------------------------------- */

export class FlankingSettings extends RCRSettingsBase {
  static SETTING_KEYS = ["enableFlanking", "flankingBehaviour", "flankingRequiresActive", "flankingNoDaisyChain"];

  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    id: "rcr-settings-flanking",
    window: {
      title: "RCR.Settings.Flanking.Legend",
      icon: "fa-solid fa-people-arrows",
      contentClasses: ["standard-form"],
    },
  }, { inplace: false });

  _buildFormHtml() {
    return `<fieldset>
      ${this._checkbox("enableFlanking", getSetting("enableFlanking"))}
      ${this._select("flankingBehaviour", advChoices(), getSetting("flankingBehaviour"))}
      ${this._checkbox("flankingRequiresActive", getSetting("flankingRequiresActive"))}
      ${this._select("flankingNoDaisyChain", daisyChainChoices(), getSetting("flankingNoDaisyChain"))}
    </fieldset>`;
  }
}

/* -------------------------------------------------- */
/*  Surrounded                                         */
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

  _buildFormHtml() {
    return `<fieldset>
      ${this._checkbox("enableSurrounded", getSetting("enableSurrounded"))}
      ${this._select("surroundedBehaviour", advChoices(), getSetting("surroundedBehaviour"))}
    </fieldset>`;
  }
}

/* -------------------------------------------------- */
/*  Elevation                                          */
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

  _buildFormHtml() {
    return `<fieldset>
      ${this._checkbox("enableHighGround", getSetting("enableHighGround"))}
      ${this._select("highGroundBehaviour", advChoices(), getSetting("highGroundBehaviour"))}
      ${this._hr()}
      ${this._checkbox("enableLowGround", getSetting("enableLowGround"))}
      ${this._select("lowGroundBehaviour", disadvChoices(), getSetting("lowGroundBehaviour"))}
    </fieldset>`;
  }
}

/* -------------------------------------------------- */
/*  Conditions                                         */
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

  _buildFormHtml() {
    return `<fieldset>
      ${this._checkbox("enableConditionAdvantage", getSetting("enableConditionAdvantage"))}
    </fieldset>`;
  }
}

/* -------------------------------------------------- */
/*  Ammunition                                         */
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

  _buildFormHtml() {
    return `<fieldset>
      ${this._checkbox("enableAmmoTracking", getSetting("enableAmmoTracking"))}
      ${this._checkbox("recoverMagicalAmmo", getSetting("recoverMagicalAmmo"))}
    </fieldset>`;
  }
}
