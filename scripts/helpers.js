// modules/reactionn-combat-rules/scripts/helpers.js

/* -------------------------------------------------- */
/*  Grid utilities (size-aware)                        */
/* -------------------------------------------------- */

const gs = () => canvas.grid.size || 1;

/** Grid rect for a token: top-left in grid coords + size in squares. */
export function tokenRect(token) {
  const g = gs();
  const rawW = token.document.width || 1;
  const rawH = token.document.height || 1;
  return {
    x: Math.floor(token.document.x / g),
    y: Math.floor(token.document.y / g),
    w: Math.max(1, Math.round(rawW)),
    h: Math.max(1, Math.round(rawH)),
  };
}

/** All grid squares a token occupies: [{gx, gy}, …] */
export function occupiedSquares(token) {
  const r = tokenRect(token);
  const out = [];
  for (let gx = r.x; gx < r.x + r.w; gx++) {
    for (let gy = r.y; gy < r.y + r.h; gy++) {
      out.push({ gx, gy });
    }
  }
  return out;
}

/** Pixel center of a grid square. */
function squareCenter(gx, gy) {
  const g = gs();
  return { x: (gx + 0.5) * g, y: (gy + 0.5) * g };
}

/* -------------------------------------------------- */
/*  Disposition                                        */
/* -------------------------------------------------- */

export function areEnemies(aDoc, bDoc) {
  if (!aDoc || !bDoc) return false;
  return aDoc.disposition !== bDoc.disposition;
}

export function areAllies(aDoc, bDoc) {
  if (!aDoc || !bDoc) return false;
  return aDoc.disposition === bDoc.disposition;
}

/* -------------------------------------------------- */
/*  Wall collision                                     */
/* -------------------------------------------------- */

export function isMovementBlocked(origin, destination) {
  try {
    const backend = CONFIG.Canvas?.polygonBackends?.move;
    if (backend?.testCollision) {
      return backend.testCollision(origin, destination, { type: "move", mode: "any" });
    }
  } catch { /* fall through */ }

  try {
    const walls = canvas.walls;
    if (walls && typeof walls.checkCollision === "function") {
      const ray = new foundry.canvas.geometry.Ray(origin, destination);
      return walls.checkCollision(ray, { type: "move", mode: "any" });
    }
  } catch { /* ignore */ }

  return false;
}

/* -------------------------------------------------- */
/*  Adjacency (multi-size aware)                       */
/*                                                     */
/*  Two tokens are adjacent if any square of A is      */
/*  Chebyshev-distance 1 from any square of B, and     */
/*  their occupied areas don't overlap.                */
/* -------------------------------------------------- */

export function isAdjacent(tokenA, tokenB) {
  const sqA = occupiedSquares(tokenA);
  const sqB = occupiedSquares(tokenB);

  // Quick overlap / distance check using rects
  const rA = tokenRect(tokenA);
  const rB = tokenRect(tokenB);
  // If gap > 1 in either axis they can't be adjacent
  const gapX = Math.max(rA.x - (rB.x + rB.w), rB.x - (rA.x + rA.w));
  const gapY = Math.max(rA.y - (rB.y + rB.h), rB.y - (rA.y + rA.h));
  if (gapX > 0 || gapY > 0) return false; // too far
  if (gapX < -1 && gapY < -1) return false; // overlapping deeply (shouldn't happen)

  const setB = new Set(sqB.map(s => `${s.gx},${s.gy}`));
  for (const a of sqA) {
    if (setB.has(`${a.gx},${a.gy}`)) continue; // overlapping square, skip
    for (const b of sqB) {
      if (Math.max(Math.abs(a.gx - b.gx), Math.abs(a.gy - b.gy)) === 1) return true;
    }
  }
  return false;
}

/* -------------------------------------------------- */
/*  Neighbor zones around a target token               */
/*                                                     */
/*  For a WxH token, cardinal sides have multiple      */
/*  neighbor squares. Diagonal corners are single       */
/*  squares at each corner.                            */
/*                                                     */
/*        NW  [--- N ---]  NE                          */
/*        [|]            [|]                           */
/*        [W]   target   [E]                           */
/*        [|]            [|]                           */
/*        SW  [--- S ---]  SE                          */
/* -------------------------------------------------- */

const OPPOSITE = { N: "S", S: "N", E: "W", W: "E", NE: "SW", SW: "NE", NW: "SE", SE: "NW" };

function neighborZones(targetToken) {
  const { x, y, w, h } = tokenRect(targetToken);
  return {
    N:  Array.from({ length: w }, (_, i) => ({ gx: x + i, gy: y - 1 })),
    S:  Array.from({ length: w }, (_, i) => ({ gx: x + i, gy: y + h })),
    W:  Array.from({ length: h }, (_, i) => ({ gx: x - 1, gy: y + i })),
    E:  Array.from({ length: h }, (_, i) => ({ gx: x + w, gy: y + i })),
    NW: [{ gx: x - 1,  gy: y - 1 }],
    NE: [{ gx: x + w,  gy: y - 1 }],
    SW: [{ gx: x - 1,  gy: y + h }],
    SE: [{ gx: x + w,  gy: y + h }],
  };
}

/** Which zones does a token touch? Returns Set of zone names. */
function touchedZones(token, zones) {
  const sq = occupiedSquares(token);
  const sqSet = new Set(sq.map(s => `${s.gx},${s.gy}`));
  const touched = new Set();
  for (const [name, cells] of Object.entries(zones)) {
    for (const c of cells) {
      if (sqSet.has(`${c.gx},${c.gy}`)) {
        touched.add(name);
        break;
      }
    }
  }
  return touched;
}

/* -------------------------------------------------- */
/*  Condition checks                                   */
/* -------------------------------------------------- */

/** Statuses that prevent a creature from contributing to a flank. */
const INACTIVE_STATUSES = new Set([
  "dead", "prone", "incapacitated", "unconscious",
  "petrified", "stunned", "paralyzed",
]);

/** True if the token has any status that makes it unable to act. */
export function isIncapacitated(token) {
  const statuses = token.actor?.statuses;
  if (!statuses) return false;
  for (const s of INACTIVE_STATUSES) {
    if (statuses.has(s)) return true;
  }
  return false;
}

/* -------------------------------------------------- */
/*  Condition-based advantage / disadvantage           */
/*                                                     */
/*  Returns { advantages: [], disadvantages: [] }      */
/*  where each entry is a { label, reason } for the    */
/*  roll note display.                                 */
/* -------------------------------------------------- */

/**
 * Evaluate advantage/disadvantage from conditions on attacker and target.
 * @param {Token} attackerToken
 * @param {Token} targetToken
 * @param {string} actionType - mwak, msak, rwak, rsak, natural
 * @returns {{ advantages: {label:string, reason:string}[], disadvantages: {label:string, reason:string}[] }}
 */
export function getConditionModifiers(attackerToken, targetToken, actionType) {
  const advantages = [];
  const disadvantages = [];

  const aStat = attackerToken.actor?.statuses ?? new Set();
  const tStat = targetToken.actor?.statuses ?? new Set();

  const isMelee = ["mwak", "msak", "natural"].includes(actionType);
  const isRanged = ["rwak", "rsak"].includes(actionType);

  // --- Attacker conditions ---

  // Blinded attacker → disadvantage
  if (aStat.has("blinded")) {
    disadvantages.push({ label: "Blinded", reason: "Attacker is blinded." });
  }

  // Frightened attacker → disadvantage (simplified: always applies)
  if (aStat.has("frightened")) {
    disadvantages.push({ label: "Frightened", reason: "Attacker is frightened." });
  }

  // Invisible attacker → advantage
  if (aStat.has("invisible")) {
    advantages.push({ label: "Invisible", reason: "Attacker is invisible." });
  }

  // Poisoned attacker → disadvantage
  if (aStat.has("poisoned")) {
    disadvantages.push({ label: "Poisoned", reason: "Attacker is poisoned." });
  }

  // Prone attacker → disadvantage on attacks
  if (aStat.has("prone")) {
    disadvantages.push({ label: "Prone", reason: "Attacker is prone." });
  }

  // Restrained attacker → disadvantage
  if (aStat.has("restrained")) {
    disadvantages.push({ label: "Restrained", reason: "Attacker is restrained." });
  }

  // --- Target conditions ---

  // Blinded target → advantage
  if (tStat.has("blinded")) {
    advantages.push({ label: "Target Blinded", reason: "Target cannot see the attacker." });
  }

  // Invisible target → disadvantage
  if (tStat.has("invisible")) {
    disadvantages.push({ label: "Target Invisible", reason: "Target is invisible." });
  }

  // Paralyzed target → advantage
  if (tStat.has("paralyzed")) {
    advantages.push({ label: "Target Paralyzed", reason: "Target is paralyzed." });
  }

  // Petrified target → advantage
  if (tStat.has("petrified")) {
    advantages.push({ label: "Target Petrified", reason: "Target is petrified." });
  }

  // Prone target → advantage if melee, disadvantage if ranged
  if (tStat.has("prone")) {
    if (isMelee) {
      advantages.push({ label: "Target Prone", reason: "Target is prone — melee has advantage." });
    } else if (isRanged) {
      disadvantages.push({ label: "Target Prone", reason: "Target is prone — ranged has disadvantage." });
    }
  }

  // Restrained target → advantage
  if (tStat.has("restrained")) {
    advantages.push({ label: "Target Restrained", reason: "Target is restrained." });
  }

  // Stunned target → advantage
  if (tStat.has("stunned")) {
    advantages.push({ label: "Target Stunned", reason: "Target is stunned." });
  }

  // Unconscious target → advantage
  if (tStat.has("unconscious")) {
    advantages.push({ label: "Target Unconscious", reason: "Target is unconscious." });
  }

  return { advantages, disadvantages };
}

/* -------------------------------------------------- */
/*  Flanking (multi-size aware)                        */
/*                                                     */
/*  Attacker is adjacent to target on some side(s).    */
/*  An ally is adjacent on the opposite side.           */
/*  Supports all 8 directions (cardinal + diagonal).   */
/*                                                     */
/*  Options:                                           */
/*    requireActive — if true, the ally must not be    */
/*    prone/incapacitated/unconscious/etc.             */
/* -------------------------------------------------- */

export function isFlanking(attackerToken, targetToken, { requireActive = false } = {}) {
  if (!canvas?.ready) return false;
  if (canvas.grid.type !== CONST.GRID_TYPES.SQUARE) return false;
  if (!areEnemies(attackerToken.document, targetToken.document)) return false;
  if (!isAdjacent(attackerToken, targetToken)) return false;

  const zones = neighborZones(targetToken);
  const attackerZones = touchedZones(attackerToken, zones);
  if (!attackerZones.size) return false;

  // For each zone the attacker touches, check for an ally on the opposite zone
  return canvas.tokens.placeables.some((t) => {
    if (t === attackerToken || t === targetToken) return false;
    if (!areAllies(t.document, attackerToken.document)) return false;
    if (!isAdjacent(t, targetToken)) return false;
    if (requireActive && isIncapacitated(t)) return false;

    const allyZones = touchedZones(t, zones);
    for (const az of attackerZones) {
      if (allyZones.has(OPPOSITE[az])) return true;
    }
    return false;
  });
}

/* -------------------------------------------------- */
/*  Surrounded (multi-size aware)                      */
/*                                                     */
/*  For each cardinal side (N/E/S/W), at least half    */
/*  (rounded up) of the neighbor squares must be       */
/*  blocked by an enemy token or a wall.               */
/* -------------------------------------------------- */

/** Check if a grid square is occupied by a hostile token. */
function squareHasEnemy(gx, gy, targetToken) {
  const tDoc = targetToken.document;
  return canvas.tokens.placeables.some((t) => {
    if (t === targetToken) return false;
    if (t.document.disposition === tDoc.disposition) return false;
    const r = tokenRect(t);
    return gx >= r.x && gx < r.x + r.w && gy >= r.y && gy < r.y + r.h;
  });
}

/** Check if a neighbor square is blocked (enemy OR wall). */
function squareBlocked(gx, gy, targetToken) {
  if (squareHasEnemy(gx, gy, targetToken)) return true;

  // Wall check: ray from the nearest target square to this neighbor
  const r = tokenRect(targetToken);
  const nearestX = Math.max(r.x, Math.min(r.x + r.w - 1, gx));
  const nearestY = Math.max(r.y, Math.min(r.y + r.h - 1, gy));
  const origin = squareCenter(nearestX, nearestY);
  const dest = squareCenter(gx, gy);

  return isMovementBlocked(origin, dest);
}

export function isSurrounded(targetToken) {
  if (!canvas?.ready) return false;
  if (canvas.grid.type !== CONST.GRID_TYPES.SQUARE) return false;

  const zones = neighborZones(targetToken);
  const cardinals = ["N", "E", "S", "W"];

  return cardinals.every((dir) => {
    const side = zones[dir];
    const needed = Math.ceil(side.length / 2);
    let blocked = 0;

    for (const { gx, gy } of side) {
      if (squareBlocked(gx, gy, targetToken)) blocked++;
      if (blocked >= needed) return true; // early out
    }
    return false;
  });
}

/* -------------------------------------------------- */
/*  High ground                                        */
/*  Attacker is at least 10 ft higher in elevation.    */
/* -------------------------------------------------- */

export function hasHighGround(attackerToken, targetToken) {
  const aElev = attackerToken.document.elevation ?? 0;
  const tElev = targetToken.document.elevation ?? 0;
  return (aElev - tElev) >= 10;
}

/* -------------------------------------------------- */
/*  Resolve attacker + target from a roll config       */
/* -------------------------------------------------- */

export function resolveTokens(config) {
  const subject = config.subject;
  const actor = subject?.actor ?? config.actor;
  if (!actor) return null;

  const actionType = subject?.actionType
    ?? subject?.item?.system?.actionType
    ?? config.item?.system?.actionType;

  if (!actionType) return null;

  const attackerToken =
    canvas.tokens.controlled.find((t) => t.actor === actor) ??
    actor.getActiveTokens(true, true)[0];
  if (!attackerToken) return null;

  const targets = [...game.user.targets];
  if (targets.length !== 1) return null;
  const targetToken = targets[0];

  if (!areEnemies(attackerToken.document, targetToken.document)) return null;

  return { attackerToken, targetToken, actionType };
}