// modules/reactionn-combat-rules/scripts/combat-rules.js

import { MODULE_ID, registerSettings, getSetting } from "./config.js";
import {
  isFlanking,
  isSurrounded,
  hasHighGround,
  getConditionModifiers,
  resolveTokens,
} from "./helpers.js";

/* -------------------------------------------------- */
/*  Track current combat status for the dialog note   */
/* -------------------------------------------------- */

let pendingStatus = null; // { flanking: bool, surrounded: bool }

/* -------------------------------------------------- */
/*  Main hook: modify attack rolls                     */
/*                                                     */
/*  dnd5e buildConfigure() flow:                       */
/*    1. preRollAttackV2 hook fires  ← we are here     */
/*    2. applyKeybindings() runs next                  */
/*       → reads roll.options.advantage (boolean)      */
/*       → derives roll.options.advantageMode from it   */
/*    3. Dialog opens                                  */
/*       → _buildAttackConfig merges parts into roll   */
/*       → _prepareButtonsContext reads advantageMode   */
/*         to highlight the correct button              */
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
      config.advantage = true;
      for (const roll of config.rolls ?? []) {
        roll.options ??= {};
        roll.options.advantage = true;
      }
    } else if (flanking) {
      for (const roll of config.rolls ?? []) {
        roll.parts ??= [];
        roll.data ??= {};
        roll.parts.push("@flanking");
        roll.data.flanking = 2;
      }
    }

    if (highGround) {
      for (const roll of config.rolls ?? []) {
        roll.parts ??= [];
        roll.data ??= {};
        roll.parts.push("@highGround");
        roll.data.highGround = 2;
      }
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
/*  Matches the dnd5e "NOTES" section style.           */
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

    // Build one or more note entries
    const entries = [];
    if (surrounded) {
      entries.push({
        icon: "fa-solid fa-arrows-to-circle",
        label: "Surrounded",
        desc: "All cardinal sides are blocked — attack has advantage.",
      });
    } else if (flanking) {
      entries.push({
        icon: "fa-solid fa-people-arrows",
        label: "Flanking",
        desc: "An ally is on the opposite side — +2 bonus to the attack roll.",
      });
    }
    if (highGround) {
      entries.push({
        icon: "fa-solid fa-mountain",
        label: "High Ground",
        desc: "Attacker is 10+ ft above the target — +2 bonus to the attack roll.",
      });
    }
    for (const adv of condAdvantages ?? []) {
      entries.push({
        icon: "fa-solid fa-circle-up",
        label: adv.label,
        desc: `${adv.reason} Advantage on the attack roll.`,
      });
    }
    for (const dis of condDisadvantages ?? []) {
      entries.push({
        icon: "fa-solid fa-circle-down",
        label: dis.label,
        desc: `${dis.reason} Disadvantage on the attack roll.`,
      });
    }

    if (!entries.length) return;

    const note = document.createElement("fieldset");
    note.className = `${MODULE_ID}-note`;
    note.innerHTML = `
      <legend>${game.i18n.localize("DND5E.Notes")}</legend>
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

// Register on all possible hook names (Foundry V2 fires per class in prototype chain)
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