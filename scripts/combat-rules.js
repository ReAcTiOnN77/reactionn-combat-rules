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
      config.advantage = true;
      for (const roll of config.rolls ?? []) {
        roll.options ??= {};
        roll.options.advantage = true;
      }
    } else if (flanking) {

      for (const roll of config.rolls ?? []) {
        roll.parts ??= [];
        roll.data ??= {};
        roll.options ??= {};
        roll.parts.push("@flanking");
        if (getSetting("flankingBehaviour") == "advantage" ) {
          roll.options.advantage = true;
        } else if (getSetting("flankingBehaviour") == "plus1" ) {
        roll.data.flanking = 1;
        } else if (getSetting("flankingBehaviour") == "plus2" ) {
        roll.data.flanking = 2;
        } else if (getSetting("flankingBehaviour") == "plus3" ) {
        roll.data.flanking = 3;
        } else if (getSetting("flankingBehaviour") == "plus4" ) {
        roll.data.flanking = 4;
        } else if (getSetting("flankingBehaviour") == "plus5" ) {
        roll.data.flanking = 5;
        }

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
      entries.push({
        icon: "fa-solid fa-arrows-to-circle",
        label: L("RCR.Note.Surrounded.Label"),
        desc: L("RCR.Note.Surrounded.Desc"),
      });
    } else if (flanking) {
        if (getSetting("flankingBehaviour") == "advantage" ) {
          entries.push({
          icon: "fa-solid fa-people-arrows",
          label: L("RCR.Note.Flanking.Label"),
          desc:  L("RCR.Note.Flanking.DescAdv"),
          });
        } else if (getSetting("flankingBehaviour") == "plus1" ) {
          entries.push({
          icon: "fa-solid fa-people-arrows",
          label: L("RCR.Note.Flanking.Label"),
          desc:  L("RCR.Note.Flanking.Desc1"),
          });
        } else if (getSetting("flankingBehaviour") == "plus2" ) {
          entries.push({
          icon: "fa-solid fa-people-arrows",
          label: L("RCR.Note.Flanking.Label"),
          desc:  L("RCR.Note.Flanking.Desc2"),
          });
        } else if (getSetting("flankingBehaviour") == "plus3" ) {
          entries.push({
          icon: "fa-solid fa-people-arrows",
          label: L("RCR.Note.Flanking.Label"),
          desc:  L("RCR.Note.Flanking.Desc3"),
          });
        } else if (getSetting("flankingBehaviour") == "plus4" ) {
          entries.push({
          icon: "fa-solid fa-people-arrows",
          label: L("RCR.Note.Flanking.Label"),
          desc:  L("RCR.Note.Flanking.Desc5"),
          });
        } else if (getSetting("flankingBehaviour") == "plus5" ) {
          entries.push({
          icon: "fa-solid fa-people-arrows",
          label: L("RCR.Note.Flanking.Label"),
          desc:  L("RCR.Note.Flanking.Desc6"),
          });
        }
    }
    if (highGround) {
      entries.push({
        icon: "fa-solid fa-mountain",
        label: L("RCR.Note.HighGround.Label"),
        desc: L("RCR.Note.HighGround.Desc"),
      });
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
