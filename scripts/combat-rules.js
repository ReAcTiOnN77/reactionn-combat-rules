// modules/reactionn-combat-rules/scripts/combat-rules.js

import { MODULE_ID, registerSettings, getSetting } from "./config.js";
import {
  isFlanking,
  isSurrounded,
  hasHighGround,
  getConditionModifiers,
  resolveTokens,
} from "./helpers.js";

const L = (key) => game.i18n.localize(key);
const LF = (key, data) => game.i18n.format(key, data);

/* -------------------------------------------------- */
/*  Behaviour lookup                                   */
/* -------------------------------------------------- */

const MODIFIERS = { plus1: 1, plus2: 2, plus3: 3, plus4: 4, plus5: 5 };

/**
 * Apply a bonus (advantage or flat modifier) to rolls.
 * @param {object} config     The roll process config
 * @param {string} behaviour  Setting value: "advantage" | "plus1"–"plus5"
 * @param {string} dataKey    Roll data key, e.g. "flanking", "surrounded", "highGround"
 */
function applyBonus(config, behaviour, dataKey) {
  const mod = MODIFIERS[behaviour];
  for (const roll of config.rolls ?? []) {
    roll.options ??= {};
    if (mod) {
      roll.parts ??= [];
      roll.data ??= {};
      roll.parts.push(`@${dataKey}`);
      roll.data[dataKey] = mod;
    } else {
      roll.options.advantage = true;
    }
  }
  if (!mod) config.advantage = true;
}

/**
 * Build a note entry for a positional bonus.
 * @param {string} icon       FontAwesome class
 * @param {string} labelKey   Localization key for label
 * @param {string} advKey     Localization key for advantage description
 * @param {string} modKey     Localization key for modifier description (uses {value})
 * @param {string} behaviour  Setting value
 * @returns {object}          { icon, label, desc }
 */
function bonusNote(icon, labelKey, advKey, modKey, behaviour) {
  const mod = MODIFIERS[behaviour];
  return {
    icon,
    label: L(labelKey),
    desc: mod ? LF(modKey, { value: mod }) : L(advKey),
  };
}

/* -------------------------------------------------- */
/*  Track current combat status for the dialog note   */
/* -------------------------------------------------- */

let pendingStatus = null;

/* -------------------------------------------------- */
/*  Main hook: modify attack rolls                     */
/* -------------------------------------------------- */

Hooks.on("dnd5e.preRollAttackV2", (config, dialog, message) => {
  try {
    pendingStatus = null;

    const tokens = resolveTokens(config);
    if (!tokens) return true;

    const { attackerToken, targetToken, actionType } = tokens;
    const isMelee = ["mwak", "msak", "natural"].includes(actionType);
    const isRanged = ["rwak", "rsak"].includes(actionType);

    let surrounded = false;
    let flanking = false;
    let highGround = false;

    if (isMelee) {
      surrounded = getSetting("enableSurrounded") && isSurrounded(targetToken);
      flanking = !surrounded
        && getSetting("enableFlanking")
        && isFlanking(attackerToken, targetToken, {
          requireActive: getSetting("flankingRequiresActive"),
        });
    }

    if (isRanged) {
      highGround = getSetting("enableHighGround")
        && hasHighGround(attackerToken, targetToken);
    }

    if (!surrounded && !flanking && !highGround) {
      if (!getSetting("enableConditionAdvantage")) return true;
    }

    if (surrounded) {
      applyBonus(config, getSetting("surroundedBehaviour"), "surrounded");
    } else if (flanking) {
      applyBonus(config, getSetting("flankingBehaviour"), "flanking");
    }

    if (highGround) {
      applyBonus(config, getSetting("highGroundBehaviour"), "highGround");
    }

    // Condition-based advantage / disadvantage
    let condAdvantages = [];
    let condDisadvantages = [];

    if (getSetting("enableConditionAdvantage")) {
      const cond = getConditionModifiers(attackerToken, targetToken, actionType);
      condAdvantages = cond.advantages;
      condDisadvantages = cond.disadvantages;

      if (condAdvantages.length || condDisadvantages.length) {
        for (const roll of config.rolls ?? []) {
          roll.options ??= {};
          if (condAdvantages.length) roll.options.advantage = true;
          if (condDisadvantages.length) roll.options.disadvantage = true;
        }
        if (condAdvantages.length) config.advantage = true;
        if (condDisadvantages.length) config.disadvantage = true;
      }
    }

    pendingStatus = { surrounded, flanking, highGround, condAdvantages, condDisadvantages };

    return true;
  } catch (e) {
    console.error(`[${MODULE_ID}]`, "preRollAttackV2 error:", e);
    return true;
  }
});

/* -------------------------------------------------- */
/*  Inject a note into the attack roll dialog          */
/* -------------------------------------------------- */

function injectNote(app, element) {
  try {
    if (!pendingStatus) return;
    if (!(app.config?.hookNames?.includes?.("attack"))) return;

    const el = element instanceof HTMLElement ? element : element?.[0];
    if (!el) return;

    if (el.querySelector(`.${MODULE_ID}-note`)) return;

    const { surrounded, flanking, highGround, condAdvantages, condDisadvantages } = pendingStatus;
    if (!surrounded && !flanking && !highGround
        && !condAdvantages?.length && !condDisadvantages?.length) return;

    const entries = [];

    if (surrounded) {
      entries.push(bonusNote(
        "fa-solid fa-arrows-to-circle",
        "RCR.Note.Surrounded.Label",
        "RCR.Note.Surrounded.DescAdv",
        "RCR.Note.Surrounded.DescMod",
        getSetting("surroundedBehaviour")
      ));
    } else if (flanking) {
      entries.push(bonusNote(
        "fa-solid fa-people-arrows",
        "RCR.Note.Flanking.Label",
        "RCR.Note.Flanking.DescAdv",
        "RCR.Note.Flanking.DescMod",
        getSetting("flankingBehaviour")
      ));
    }

    if (highGround) {
      entries.push(bonusNote(
        "fa-solid fa-mountain",
        "RCR.Note.HighGround.Label",
        "RCR.Note.HighGround.DescAdv",
        "RCR.Note.HighGround.DescMod",
        getSetting("highGroundBehaviour")
      ));
    }

    for (const adv of condAdvantages ?? []) {
      entries.push({
        icon: "fa-solid fa-circle-up",
        label: adv.label,
        desc: `${adv.reason} ${L("RCR.Note.Advantage")}`,
      });
    }
    for (const dis of condDisadvantages ?? []) {
      entries.push({
        icon: "fa-solid fa-circle-down",
        label: dis.label,
        desc: `${dis.reason} ${L("RCR.Note.Disadvantage")}`,
      });
    }

    if (!entries.length) return;

    const note = document.createElement("fieldset");
    note.className = `${MODULE_ID}-note`;
    note.innerHTML = `
      <legend>${L("DND5E.Notes")}</legend>
      ${entries.map(e => `
        <div style="display:flex; align-items:start; gap:0.5rem; padding:0.25rem 0;">
          <i class="${e.icon}" style="margin-top:0.15rem;"></i>
          <div>
            <strong>${e.label}</strong>
            <div class="hint" style="font-size:var(--font-size-11, 11px); opacity:0.8;">${e.desc}</div>
          </div>
        </div>
      `).join("")}
    `;

    const buttons = el.querySelector(".form-footer, [data-application-part='buttons']");
    if (buttons) {
      buttons.parentNode.insertBefore(note, buttons);
    } else {
      el.appendChild(note);
    }
  } catch (err) {
    // Silently ignore — cosmetic only
  }
}

for (const hookName of [
  "renderRollConfigurationDialog",
  "renderD20RollConfigurationDialog",
  "renderAttackRollConfigurationDialog",
  "renderApplication",
  "renderApplicationV2"
]) {
  Hooks.on(hookName, injectNote);
}

/* -------------------------------------------------- */
/*  Init & Ready                                       */
/* -------------------------------------------------- */

Hooks.once("init", () => {
  registerSettings();
});

Hooks.once("ready", () => {
  console.log(`[${MODULE_ID}] Combat Rules loaded.`);
});
