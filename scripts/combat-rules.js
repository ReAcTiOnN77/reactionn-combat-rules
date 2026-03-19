import { MODULE_ID, registerSettings, getSetting } from "./config.js";
import {
  isFlanking,
  isSurrounded,
  hasHighGround,
  hasLowGround,
  getConditionModifiers,
  resolveTokens,
} from "./helpers.js";
import {
  onCombatUpdate,
  onCombatantCreate,
  onCombatPreDelete,
  onCombatDelete,
  registerSocketListener,
} from "./ammo-tracker.js";

const L = (key) => game.i18n.localize(key);
const LF = (key, data) => game.i18n.format(key, data);

/* -------------------------------------------------- */
/*  Behaviour lookups                                  */
/* -------------------------------------------------- */

const MODIFIERS = { plus1: 1, plus2: 2, plus3: 3, plus4: 4, plus5: 5 };
const PENALTIES = { minus1: -1, minus2: -2, minus3: -3, minus4: -4, minus5: -5 };

// Handles both bonuses and penalties depending on which lookup the key falls into.
// If an external roll-state manager is present, patches its baselines and subject arrays too.
function applyModifier(config, behaviour, dataKey, label) {
  const value = MODIFIERS[behaviour] ?? PENALTIES[behaviour];
  const isAdv = behaviour === "advantage";
  const isDisadv = behaviour === "disadvantage";

  for (const roll of config.rolls ?? []) {
    roll.options ??= {};
    if (value) {
      roll.parts ??= [];
      roll.data ??= {};
      roll.parts.push(`@${dataKey}`);
      roll.data[dataKey] = value;
    } else if (isAdv) {
      roll.options.advantage = true;
    } else if (isDisadv) {
      roll.options.disadvantage = true;
    }
  }

  if (isAdv) config.advantage = true;
  if (isDisadv) config.disadvantage = true;

  // If an external module manages roll state, patch its data too
  const ext = getExternalRollConfig(config);
  if (!ext) return;

  if (value) {
    for (const bl of collectFrozenBaselines(ext)) {
      if (Array.isArray(bl.parts)) bl.parts.push(`@${dataKey}`);
    }
  } else if (isAdv) {
    ext.subject.advantage ??= [];
    ext.subject.advantage.push(label);
  } else if (isDisadv) {
    ext.subject.disadvantage ??= [];
    ext.subject.disadvantage.push(label);
  }
}

/* -------------------------------------------------- */
/*  External roll-state detection                      */
/* -------------------------------------------------- */

// Find any module config on roll0.options that manages advantage via subject arrays
function getExternalRollConfig(config) {
  const opts = config?.rolls?.[0]?.options;
  if (!opts) return null;
  for (const val of Object.values(opts)) {
    if (val && typeof val === "object" && val.subject && typeof val.subject === "object") return val;
  }
  return null;
}

// Collect frozen baseline snapshots (any depth) so we can patch parts into them
function collectFrozenBaselines(ext) {
  const out = [];
  if (ext.frozenD20Baseline) out.push(ext.frozenD20Baseline);
  for (const val of Object.values(ext)) {
    if (!val || typeof val !== "object" || Array.isArray(val)) continue;
    if (val.frozenD20Baseline && !out.includes(val.frozenD20Baseline)) out.push(val.frozenD20Baseline);
    if (val.frozenD20BaselineByProfile) {
      for (const bl of Object.values(val.frozenD20BaselineByProfile)) {
        if (bl && !out.includes(bl)) out.push(bl);
      }
    }
  }
  return out;
}

/* -------------------------------------------------- */

function buildNote(icon, labelKey, advDisadvKey, modKey, behaviour) {
  const value = MODIFIERS[behaviour] ?? PENALTIES[behaviour];
  return {
    icon,
    label: L(labelKey),
    desc: value ? LF(modKey, { value }) : L(advDisadvKey),
  };
}

/* -------------------------------------------------- */
/*  Track current combat status for the dialog note    */
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
    let flankingBlocked = null;
    let highGround = false;
    let lowGround = false;

    if (isMelee) {
      surrounded = getSetting("enableSurrounded") && isSurrounded(targetToken);
      flanking = !surrounded
        && getSetting("enableFlanking")
        && isFlanking(attackerToken, targetToken, {
          requireActive: getSetting("flankingRequiresActive"),
          noDaisyChain: getSetting("flankingNoDaisyChain"),
        });

      // Detect why flanking was blocked by flags (for roll notes)
      if (!flanking && !surrounded && getSetting("enableFlanking")) {
        const opts = {
          requireActive: getSetting("flankingRequiresActive"),
          noDaisyChain: getSetting("flankingNoDaisyChain"),
          ignoreFlags: true,
        };
        if (isFlanking(attackerToken, targetToken, opts)) {
          if (targetToken.actor?.getFlag(MODULE_ID, "flankingImmune")) {
            flankingBlocked = "immune";
          } else {
            flankingBlocked = "cannotFlank";
          }
        }
      }
    }

    if (isRanged) {
      highGround = getSetting("enableHighGround")
        && hasHighGround(attackerToken, targetToken);
      lowGround = !highGround
        && getSetting("enableLowGround")
        && hasLowGround(attackerToken, targetToken);
    }

    if (!surrounded && !flanking && !flankingBlocked && !highGround && !lowGround) {
      if (!getSetting("enableConditionAdvantage")) return true;
    }

    if (surrounded) applyModifier(config, getSetting("surroundedBehaviour"), "surrounded", L("RCR.Note.Surrounded.Label"));
    else if (flanking) applyModifier(config, getSetting("flankingBehaviour"), "flanking", L("RCR.Note.Flanking.Label"));

    if (highGround) applyModifier(config, getSetting("highGroundBehaviour"), "highGround", L("RCR.Note.HighGround.Label"));
    if (lowGround) applyModifier(config, getSetting("lowGroundBehaviour"), "lowGround", L("RCR.Note.LowGround.Label"));

    // Always compute conditions for roll notes; skip config writes if an external module handles them
    let condAdvantages = [];
    let condDisadvantages = [];

    if (getSetting("enableConditionAdvantage")) {
      const cond = getConditionModifiers(attackerToken, targetToken, actionType);
      condAdvantages = cond.advantages;
      condDisadvantages = cond.disadvantages;

      if (!getExternalRollConfig(config) && (condAdvantages.length || condDisadvantages.length)) {
        for (const roll of config.rolls ?? []) {
          roll.options ??= {};
          if (condAdvantages.length) roll.options.advantage = true;
          if (condDisadvantages.length) roll.options.disadvantage = true;
        }
        if (condAdvantages.length) config.advantage = true;
        if (condDisadvantages.length) config.disadvantage = true;
      }
    }

    pendingStatus = { surrounded, flanking, flankingBlocked, highGround, lowGround, condAdvantages, condDisadvantages };

    return true;
  } catch (e) {
    console.error(`${MODULE_ID} | preRollAttackV2 error:`, e);
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

    const { surrounded, flanking, flankingBlocked, highGround, lowGround, condAdvantages, condDisadvantages } = pendingStatus;
    if (!surrounded && !flanking && !flankingBlocked && !highGround && !lowGround
        && !condAdvantages?.length && !condDisadvantages?.length) return;

    const entries = [];

    if (surrounded) {
      entries.push(buildNote("fa-solid fa-arrows-to-circle", "RCR.Note.Surrounded.Label",
        "RCR.Note.Surrounded.DescAdv", "RCR.Note.Surrounded.DescMod", getSetting("surroundedBehaviour")));
    } else if (flanking) {
      entries.push(buildNote("fa-solid fa-people-arrows", "RCR.Note.Flanking.Label",
        "RCR.Note.Flanking.DescAdv", "RCR.Note.Flanking.DescMod", getSetting("flankingBehaviour")));
    } else if (flankingBlocked === "immune") {
      entries.push({
        icon: "fa-solid fa-shield",
        label: L("RCR.Note.NoFlanking.Label"),
        desc: L("RCR.Note.FlankingImmune"),
      });
    } else if (flankingBlocked === "cannotFlank") {
      entries.push({
        icon: "fa-solid fa-ban",
        label: L("RCR.Note.NoFlanking.Label"),
        desc: L("RCR.Note.CannotFlank"),
      });
    }

    if (highGround) {
      entries.push(buildNote("fa-solid fa-mountain", "RCR.Note.HighGround.Label",
        "RCR.Note.HighGround.DescAdv", "RCR.Note.HighGround.DescMod", getSetting("highGroundBehaviour")));
    }

    if (lowGround) {
      entries.push(buildNote("fa-solid fa-mountain-sun", "RCR.Note.LowGround.Label",
        "RCR.Note.LowGround.DescDisadv", "RCR.Note.LowGround.DescMod", getSetting("lowGroundBehaviour")));
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
    if (buttons) buttons.parentNode.insertBefore(note, buttons);
    else el.appendChild(note);
  } catch (err) {
    // Cosmetic only
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
/*  Ammo tracker hooks                                 */
/* -------------------------------------------------- */

Hooks.on("updateCombat", onCombatUpdate);
Hooks.on("createCombatant", onCombatantCreate);
Hooks.on("preDeleteCombat", onCombatPreDelete);
Hooks.on("deleteCombat", onCombatDelete);

/* -------------------------------------------------- */
/*  Init & Ready                                       */
/* -------------------------------------------------- */

Hooks.once("init", () => {
  registerSettings();
});

Hooks.once("ready", () => {
  registerSocketListener();
  console.log(`${MODULE_ID} | Combat Rules loaded`);
});