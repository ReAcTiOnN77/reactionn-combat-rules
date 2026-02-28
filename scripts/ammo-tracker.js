import { MODULE_ID, getSetting } from "./config.js";

const L = (key) => game.i18n.localize(key);
const LF = (key, data) => game.i18n.format(key, data);

const DialogV2 = () => foundry.applications.api.DialogV2;

/* -------------------------------------------------- */
/*  In-memory snapshot cache                           */
/* -------------------------------------------------- */

const pendingSnapshots = new Map();

/* -------------------------------------------------- */
/*  Item helpers                                       */
/* -------------------------------------------------- */

function isAmmo(item) {
  if (item.type !== "consumable") return false;
  return item.system.type?.value === "ammo";
}

function isMagical(item) {
  return item.system.properties?.has?.("mgc") ?? false;
}

/* -------------------------------------------------- */
/*  Snapshot: record all PC ammo at combat start       */
/* -------------------------------------------------- */

export function snapshotAmmo(combat) {
  const snapshot = {};

  for (const combatant of combat.combatants) {
    const actor = combatant.actor;
    if (!actor || actor.type !== "character") continue;

    const ammoItems = actor.items.filter(isAmmo);
    if (!ammoItems.length) continue;

    snapshot[actor.id] = {};
    for (const item of ammoItems) {
      snapshot[actor.id][item.id] = {
        name: item.name,
        img: item.img,
        quantity: item.system.quantity ?? 0,
        magical: isMagical(item),
      };
    }
  }

  return snapshot;
}

/* -------------------------------------------------- */
/*  Diff: calculate consumed ammo per actor            */
/* -------------------------------------------------- */

export function calculateUsed(snapshot) {
  const recoverMagical = getSetting("recoverMagicalAmmo");
  const results = [];

  for (const [actorId, items] of Object.entries(snapshot)) {
    const actor = game.actors.get(actorId);
    if (!actor) continue;

    const usedItems = [];
    for (const [itemId, data] of Object.entries(items)) {
      const item = actor.items.get(itemId);
      const currentQty = item?.system?.quantity ?? 0;
      const consumed = data.quantity - currentQty;
      if (consumed <= 0) continue;

      const canRecover = !data.magical || recoverMagical;
      const recoverable = canRecover ? Math.floor(consumed / 2) : 0;

      usedItems.push({
        itemId,
        name: data.name,
        img: data.img,
        startQty: data.quantity,
        endQty: currentQty,
        consumed,
        magical: data.magical,
        recoverable,
        exists: !!item,
      });
    }

    if (usedItems.length) {
      results.push({ actorId, actor, items: usedItems });
    }
  }

  return results;
}

/* -------------------------------------------------- */
/*  Recovery: add recoverable ammo back to inventory   */
/* -------------------------------------------------- */

async function recoverAmmo(actor, usedItems) {
  const updates = [];

  for (const entry of usedItems) {
    if (entry.recoverable <= 0 || !entry.exists) continue;
    const item = actor.items.get(entry.itemId);
    if (!item) continue;

    const currentQty = item.system.quantity ?? 0;
    updates.push({ _id: entry.itemId, "system.quantity": currentQty + entry.recoverable });
  }

  if (updates.length) {
    await actor.updateEmbeddedDocuments("Item", updates);
  }

  return updates.length;
}

/* -------------------------------------------------- */
/*  Build dialog HTML content                          */
/* -------------------------------------------------- */

function buildDialogContent(usedItems) {
  const totalRecoverable = usedItems.reduce((sum, i) => sum + i.recoverable, 0);

  const rows = usedItems.map(item => {
    const magicIcon = item.magical
      ? ` <i class="fa-solid fa-wand-sparkles" title="${L("RCR.Ammo.Magical")}" style="color:#c79cff;"></i>`
      : "";

    let recoverText;
    if (item.magical && !getSetting("recoverMagicalAmmo")) {
      recoverText = `<span style="opacity:0.5; font-style:italic;">${L("RCR.Ammo.NoMagicalRecovery")}</span>`;
    } else if (!item.exists) {
      recoverText = `<span style="opacity:0.5; font-style:italic;">${L("RCR.Ammo.ItemDeleted")}</span>`;
    } else {
      recoverText = `<strong>${item.recoverable}</strong>`;
    }

    return `
      <div style="display:flex; align-items:center; gap:0.5rem; padding:0.4rem 0; border-bottom:1px solid var(--color-border-light-tertiary, #3331);">
        <img src="${item.img}" width="28" height="28" style="border:none; flex-shrink:0;">
        <div style="flex:1; min-width:0;">
          <div style="font-weight:bold;">${item.name}${magicIcon}</div>
          <div style="font-size:var(--font-size-11, 11px); opacity:0.8;">
            ${LF("RCR.Ammo.UsedDetail", { start: item.startQty, end: item.endQty, consumed: item.consumed })}
          </div>
        </div>
        <div style="text-align:right; flex-shrink:0; min-width:3rem;">
          ${recoverText}
        </div>
      </div>`;
  }).join("");

  return `
    <div class="rcr-ammo-recovery">
      <p style="margin-top:0;">${L("RCR.Ammo.RecoveryIntro")}</p>
      <div style="margin:0.5rem 0;">${rows}</div>
      ${totalRecoverable > 0
        ? `<p style="margin-bottom:0;"><strong>${LF("RCR.Ammo.TotalRecoverable", { total: totalRecoverable })}</strong></p>`
        : ""}
    </div>`;
}

/* -------------------------------------------------- */
/*  Recovery dialog (DialogV2.wait)                    */
/* -------------------------------------------------- */

export async function showRecoveryDialog(actor, usedItems) {
  const totalRecoverable = usedItems.reduce((sum, i) => sum + i.recoverable, 0);
  const content = buildDialogContent(usedItems);

  const buttons = [];

  if (totalRecoverable > 0) {
    buttons.push({
      action: "recover",
      label: L("RCR.Ammo.Recover"),
      icon: "fa-solid fa-rotate-left",
      default: true,
      callback: async () => {
        const count = await recoverAmmo(actor, usedItems);
        if (count > 0) {
          ui.notifications.info(LF("RCR.Ammo.RecoveryComplete", { name: actor.name }));
        }
        return true;
      },
    });
  }

  buttons.push({
    action: "dismiss",
    label: L("RCR.Ammo.Dismiss"),
    icon: "fa-solid fa-xmark",
    default: totalRecoverable <= 0,
  });

  await DialogV2().wait({
    window: {
      title: LF("RCR.Ammo.RecoveryTitle", { name: actor.name }),
      icon: "fa-solid fa-bow-arrow",
    },
    content,
    buttons,
    position: { width: 420 },
    rejectClose: false,
  });
}

/* -------------------------------------------------- */
/*  Combat hooks                                       */
/* -------------------------------------------------- */

export async function onCombatUpdate(combat, change) {
  if (!game.user.isGM) return;
  if (!getSetting("enableAmmoTracking")) return;
  if (combat.round === 0) return;
  if (combat.getFlag(MODULE_ID, "ammoSnapshot")) return;

  const snapshot = snapshotAmmo(combat);
  if (Object.keys(snapshot).length) {
    await combat.setFlag(MODULE_ID, "ammoSnapshot", snapshot);
    console.log(`${MODULE_ID} | Ammo snapshot saved for combat ${combat.id}`);
  }
}

// Append late joiners to the existing snapshot
export async function onCombatantCreate(combatant) {
  if (!game.user.isGM) return;
  if (!getSetting("enableAmmoTracking")) return;

  const combat = combatant.combat;
  if (!combat || combat.round === 0) return;

  const existing = combat.getFlag(MODULE_ID, "ammoSnapshot");
  if (!existing) return;

  const actor = combatant.actor;
  if (!actor || actor.type !== "character") return;
  if (existing[actor.id]) return;

  const ammoItems = actor.items.filter(isAmmo);
  if (!ammoItems.length) return;

  const actorSnapshot = {};
  for (const item of ammoItems) {
    actorSnapshot[item.id] = {
      name: item.name,
      img: item.img,
      quantity: item.system.quantity ?? 0,
      magical: isMagical(item),
    };
  }

  await combat.setFlag(MODULE_ID, "ammoSnapshot", {
    ...existing,
    [actor.id]: actorSnapshot,
  });
  console.log(`${MODULE_ID} | Ammo snapshot updated - added ${actor.name}`);
}

// Cache snapshot before the combat document gets deleted
export function onCombatPreDelete(combat) {
  if (!getSetting("enableAmmoTracking")) return;
  const snapshot = combat.getFlag(MODULE_ID, "ammoSnapshot");
  if (snapshot) pendingSnapshots.set(combat.id, snapshot);
}

// Show recovery dialogs to each player that owns an actor with consumed ammo
export function onCombatDelete(combat) {
  if (!getSetting("enableAmmoTracking")) return;

  const snapshot = pendingSnapshots.get(combat.id);
  pendingSnapshots.delete(combat.id);
  if (!snapshot) return;

  const results = calculateUsed(snapshot);

  for (const { actor, items } of results) {
    if (!actor.isOwner) continue;
    showRecoveryDialog(actor, items);
  }
}
