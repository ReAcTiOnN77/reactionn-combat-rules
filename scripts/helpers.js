const L = (key) => game.i18n.localize(key);
const LF = (key, data) => game.i18n.format(key, data);

/* -------------------------------------------------- */
/*  Grid utilities                                     */
/* -------------------------------------------------- */

const gs = () => canvas.grid.size || 1;

const HEX_TYPES = new Set([
  CONST.GRID_TYPES.HEXODDR,
  CONST.GRID_TYPES.HEXEVENR,
  CONST.GRID_TYPES.HEXODDQ,
  CONST.GRID_TYPES.HEXEVENQ,
]);

function isHexGrid() {
  return HEX_TYPES.has(canvas.grid.type);
}

/* -------------------------------------------------- */
/*  Square grid utilities                              */
/* -------------------------------------------------- */

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

function squareCenter(gx, gy) {
  const g = gs();
  return { x: (gx + 0.5) * g, y: (gy + 0.5) * g };
}

/* -------------------------------------------------- */
/*  Hex grid utilities                                 */
/* -------------------------------------------------- */

// Pixel center of the hex cell a token occupies
function tokenHexCenter(token) {
  const off = canvas.grid.getOffset({ x: token.document.x, y: token.document.y });
  return canvas.grid.getCenterPoint(off);
}

// Grid offset {i, j} for a token's primary hex cell
function tokenOffset(token) {
  return canvas.grid.getOffset({ x: token.document.x, y: token.document.y });
}

function offsetEq(a, b) {
  return a.i === b.i && a.j === b.j;
}

// 6 neighbor offsets via angle probing - works for both pointy and flat top.
// Direction (n+3)%6 is always the opposite of direction n.
function hexNeighbors(token) {
  const center = tokenHexCenter(token);
  const g = gs();
  const neighbors = [];
  for (let d = 0; d < 6; d++) {
    const angle = d * Math.PI / 3;
    neighbors.push(canvas.grid.getOffset({
      x: center.x + Math.cos(angle) * g,
      y: center.y + Math.sin(angle) * g,
    }));
  }
  return neighbors;
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

// Try polygon backend first, fall back to legacy walls layer
export function isMovementBlocked(origin, destination) {
  try {
    const backend = CONFIG.Canvas?.polygonBackends?.move;
    if (backend?.testCollision) {
      return backend.testCollision(origin, destination, { type: "move", mode: "any" });
    }
  } catch {}

  try {
    const walls = canvas.walls;
    if (walls && typeof walls.checkCollision === "function") {
      const ray = new foundry.canvas.geometry.Ray(origin, destination);
      return walls.checkCollision(ray, { type: "move", mode: "any" });
    }
  } catch {}

  return false;
}

/* -------------------------------------------------- */
/*  Adjacency                                          */
/* -------------------------------------------------- */

export function isAdjacent(tokenA, tokenB) {
  if (isHexGrid()) {
    const neighbors = hexNeighbors(tokenB);
    const offA = tokenOffset(tokenA);
    return neighbors.some(n => offsetEq(n, offA));
  }

  // Square grid (multi-size aware)
  const sqA = occupiedSquares(tokenA);
  const sqB = occupiedSquares(tokenB);

  const rA = tokenRect(tokenA);
  const rB = tokenRect(tokenB);
  const gapX = Math.max(rA.x - (rB.x + rB.w), rB.x - (rA.x + rA.w));
  const gapY = Math.max(rA.y - (rB.y + rB.h), rB.y - (rA.y + rA.h));
  if (gapX > 0 || gapY > 0) return false;
  if (gapX < -1 && gapY < -1) return false;

  const setB = new Set(sqB.map(s => `${s.gx},${s.gy}`));
  for (const a of sqA) {
    if (setB.has(`${a.gx},${a.gy}`)) continue;
    for (const b of sqB) {
      if (Math.max(Math.abs(a.gx - b.gx), Math.abs(a.gy - b.gy)) === 1) return true;
    }
  }
  return false;
}

/* -------------------------------------------------- */
/*  Neighbor zones around a target (square grid)       */
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

const INACTIVE_STATUSES = new Set([
  "dead", "prone", "incapacitated", "unconscious",
  "petrified", "stunned", "paralyzed",
]);

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
/* -------------------------------------------------- */

export function getConditionModifiers(attackerToken, targetToken, actionType) {
  const advantages = [];
  const disadvantages = [];

  const aStat = attackerToken.actor?.statuses ?? new Set();
  const tStat = targetToken.actor?.statuses ?? new Set();

  const isMelee = ["mwak", "msak", "natural"].includes(actionType);
  const isRanged = ["rwak", "rsak"].includes(actionType);

  // Attacker
  if (aStat.has("blinded"))
    disadvantages.push({ label: L("RCR.Condition.Blinded"), reason: L("RCR.Reason.AttackerBlinded") });
  if (aStat.has("frightened"))
    disadvantages.push({ label: L("RCR.Condition.Frightened"), reason: L("RCR.Reason.AttackerFrightened") });
  if (aStat.has("invisible"))
    advantages.push({ label: L("RCR.Condition.Invisible"), reason: L("RCR.Reason.AttackerInvisible") });
  if (aStat.has("poisoned"))
    disadvantages.push({ label: L("RCR.Condition.Poisoned"), reason: L("RCR.Reason.AttackerPoisoned") });
  if (aStat.has("prone"))
    disadvantages.push({ label: L("RCR.Condition.Prone"), reason: L("RCR.Reason.AttackerProne") });
  if (aStat.has("restrained"))
    disadvantages.push({ label: L("RCR.Condition.Restrained"), reason: L("RCR.Reason.AttackerRestrained") });

  // Target
  if (tStat.has("blinded"))
    advantages.push({ label: LF("RCR.Target.Prefix", { label: L("RCR.Condition.Blinded") }), reason: L("RCR.Reason.TargetBlinded") });
  if (tStat.has("invisible"))
    disadvantages.push({ label: LF("RCR.Target.Prefix", { label: L("RCR.Condition.Invisible") }), reason: L("RCR.Reason.TargetInvisible") });
  if (tStat.has("paralyzed"))
    advantages.push({ label: LF("RCR.Target.Prefix", { label: L("RCR.Condition.Paralyzed") }), reason: L("RCR.Reason.TargetParalyzed") });
  if (tStat.has("petrified"))
    advantages.push({ label: LF("RCR.Target.Prefix", { label: L("RCR.Condition.Petrified") }), reason: L("RCR.Reason.TargetPetrified") });

  if (tStat.has("prone")) {
    if (isMelee)
      advantages.push({ label: LF("RCR.Target.Prefix", { label: L("RCR.Condition.Prone") }), reason: L("RCR.Reason.TargetProneMelee") });
    else if (isRanged)
      disadvantages.push({ label: LF("RCR.Target.Prefix", { label: L("RCR.Condition.Prone") }), reason: L("RCR.Reason.TargetProneRanged") });
  }

  if (tStat.has("restrained"))
    advantages.push({ label: LF("RCR.Target.Prefix", { label: L("RCR.Condition.Restrained") }), reason: L("RCR.Reason.TargetRestrained") });
  if (tStat.has("stunned"))
    advantages.push({ label: LF("RCR.Target.Prefix", { label: L("RCR.Condition.Stunned") }), reason: L("RCR.Reason.TargetStunned") });
  if (tStat.has("unconscious"))
    advantages.push({ label: LF("RCR.Target.Prefix", { label: L("RCR.Condition.Unconscious") }), reason: L("RCR.Reason.TargetUnconscious") });

  return { advantages, disadvantages };
}

/* -------------------------------------------------- */
/*  Daisy chain check (non-recursive)                  */
/* -------------------------------------------------- */

// Returns true if enemies occupy opposite sides of this token
function isGeometricallyFlanked(token) {
  if (isHexGrid()) {
    const neighbors = hexNeighbors(token);
    for (let d = 0; d < 3; d++) {
      const offD = neighbors[d];
      const offOpp = neighbors[(d + 3) % 6];
      const enemyInD = canvas.tokens.placeables.some(t => {
        if (t === token) return false;
        if (!areEnemies(t.document, token.document)) return false;
        return offsetEq(tokenOffset(t), offD);
      });
      if (!enemyInD) continue;
      const enemyInOpp = canvas.tokens.placeables.some(t => {
        if (t === token) return false;
        if (!areEnemies(t.document, token.document)) return false;
        return offsetEq(tokenOffset(t), offOpp);
      });
      if (enemyInOpp) return true;
    }
    return false;
  }

  if (canvas.grid.type !== CONST.GRID_TYPES.SQUARE) return false;

  const zones = neighborZones(token);
  const checked = new Set();
  for (const [dir, opp] of Object.entries(OPPOSITE)) {
    const pairKey = dir < opp ? `${dir}-${opp}` : `${opp}-${dir}`;
    if (checked.has(pairKey)) continue;
    checked.add(pairKey);

    const hasEnemyInDir = zones[dir].some(({ gx, gy }) =>
      canvas.tokens.placeables.some(t => {
        if (t === token) return false;
        if (!areEnemies(t.document, token.document)) return false;
        const r = tokenRect(t);
        return gx >= r.x && gx < r.x + r.w && gy >= r.y && gy < r.y + r.h;
      })
    );
    if (!hasEnemyInDir) continue;

    const hasEnemyInOpp = zones[opp].some(({ gx, gy }) =>
      canvas.tokens.placeables.some(t => {
        if (t === token) return false;
        if (!areEnemies(t.document, token.document)) return false;
        const r = tokenRect(t);
        return gx >= r.x && gx < r.x + r.w && gy >= r.y && gy < r.y + r.h;
      })
    );
    if (hasEnemyInOpp) return true;
  }
  return false;
}

/* -------------------------------------------------- */
/*  Flanking                                           */
/* -------------------------------------------------- */

export function isFlanking(attackerToken, targetToken, { requireActive = false, noDaisyChain = "off" } = {}) {
  if (!canvas?.ready) return false;

  if (isHexGrid()) return isFlankingHex(attackerToken, targetToken, requireActive, noDaisyChain);
  if (canvas.grid.type !== CONST.GRID_TYPES.SQUARE) return false;
  return isFlankingSquare(attackerToken, targetToken, requireActive, noDaisyChain);
}

// Hex: attacker in direction d, ally in direction (d+3)%6
function isFlankingHex(attackerToken, targetToken, requireActive, noDaisyChain) {
  if (!areEnemies(attackerToken.document, targetToken.document)) return false;
  if (noDaisyChain === "both" && isGeometricallyFlanked(attackerToken)) return false;

  const neighbors = hexNeighbors(targetToken);
  const attackerOff = tokenOffset(attackerToken);

  const attackerDir = neighbors.findIndex(n => offsetEq(n, attackerOff));
  if (attackerDir === -1) return false;

  const oppositeOff = neighbors[(attackerDir + 3) % 6];

  return canvas.tokens.placeables.some(t => {
    if (t === attackerToken || t === targetToken) return false;
    if (!areAllies(t.document, attackerToken.document)) return false;
    if (requireActive && isIncapacitated(t)) return false;
    if (!offsetEq(tokenOffset(t), oppositeOff)) return false;
    if (noDaisyChain !== "off" && isGeometricallyFlanked(t)) return false;
    return true;
  });
}

// Square: multi-size zone-based opposite check
function isFlankingSquare(attackerToken, targetToken, requireActive, noDaisyChain) {
  if (!areEnemies(attackerToken.document, targetToken.document)) return false;
  if (!isAdjacent(attackerToken, targetToken)) return false;
  if (noDaisyChain === "both" && isGeometricallyFlanked(attackerToken)) return false;

  const zones = neighborZones(targetToken);
  const attackerZones = touchedZones(attackerToken, zones);
  if (!attackerZones.size) return false;

  return canvas.tokens.placeables.some((t) => {
    if (t === attackerToken || t === targetToken) return false;
    if (!areAllies(t.document, attackerToken.document)) return false;
    if (!isAdjacent(t, targetToken)) return false;
    if (requireActive && isIncapacitated(t)) return false;

    const allyZones = touchedZones(t, zones);
    let hasOpposite = false;
    for (const az of attackerZones) {
      if (allyZones.has(OPPOSITE[az])) { hasOpposite = true; break; }
    }
    if (!hasOpposite) return false;
    if (noDaisyChain !== "off" && isGeometricallyFlanked(t)) return false;
    return true;
  });
}

/* -------------------------------------------------- */
/*  Surrounded                                         */
/* -------------------------------------------------- */

export function isSurrounded(targetToken) {
  if (!canvas?.ready) return false;

  if (isHexGrid()) return isSurroundedHex(targetToken);
  if (canvas.grid.type !== CONST.GRID_TYPES.SQUARE) return false;
  return isSurroundedSquare(targetToken);
}

// Hex: all 6 adjacent hexes blocked by enemy or wall
function isSurroundedHex(targetToken) {
  const neighbors = hexNeighbors(targetToken);
  const center = tokenHexCenter(targetToken);

  return neighbors.every(neighborOff => {
    const hasEnemy = canvas.tokens.placeables.some(t => {
      if (t === targetToken) return false;
      if (t.document.disposition === targetToken.document.disposition) return false;
      return offsetEq(tokenOffset(t), neighborOff);
    });
    if (hasEnemy) return true;

    const neighborCenter = canvas.grid.getCenterPoint(neighborOff);
    return isMovementBlocked(center, neighborCenter);
  });
}

// Square: multi-size cardinal-side check
function isSurroundedSquare(targetToken) {
  const zones = neighborZones(targetToken);
  const cardinals = ["N", "E", "S", "W"];

  return cardinals.every((dir) => {
    const side = zones[dir];
    const needed = Math.ceil(side.length / 2);
    let blocked = 0;

    for (const { gx, gy } of side) {
      if (squareBlocked(gx, gy, targetToken)) blocked++;
      if (blocked >= needed) return true;
    }
    return false;
  });
}

function squareHasEnemy(gx, gy, targetToken) {
  const tDoc = targetToken.document;
  return canvas.tokens.placeables.some((t) => {
    if (t === targetToken) return false;
    if (t.document.disposition === tDoc.disposition) return false;
    const r = tokenRect(t);
    return gx >= r.x && gx < r.x + r.w && gy >= r.y && gy < r.y + r.h;
  });
}

function squareBlocked(gx, gy, targetToken) {
  if (squareHasEnemy(gx, gy, targetToken)) return true;

  const r = tokenRect(targetToken);
  const nearestX = Math.max(r.x, Math.min(r.x + r.w - 1, gx));
  const nearestY = Math.max(r.y, Math.min(r.y + r.h - 1, gy));
  const origin = squareCenter(nearestX, nearestY);
  const dest = squareCenter(gx, gy);

  return isMovementBlocked(origin, dest);
}

/* -------------------------------------------------- */
/*  Elevation - 10ft threshold                         */
/* -------------------------------------------------- */

export function hasHighGround(attackerToken, targetToken) {
  const aElev = attackerToken.document.elevation ?? 0;
  const tElev = targetToken.document.elevation ?? 0;
  return (aElev - tElev) >= 10;
}

export function hasLowGround(attackerToken, targetToken) {
  const aElev = attackerToken.document.elevation ?? 0;
  const tElev = targetToken.document.elevation ?? 0;
  return (tElev - aElev) >= 10;
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

  return { attackerToken, targetToken, actionType };
}