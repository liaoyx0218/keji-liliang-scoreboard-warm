import type { BubblePlacement } from "./bubbleLayout";

export type BubbleBody = {
  groupId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
};

const MARGIN = 16;
const GAP = 10;
/** Screensaver-like drift speed (px/s). */
const SPEED_MIN = 14;
const SPEED_MAX = 32;

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seedVelocity(groupId: string): { vx: number; vy: number } {
  const h = hashSeed(groupId);
  const angle = ((h % 360) / 360) * Math.PI * 2;
  const speed = SPEED_MIN + ((h >>> 8) % 1000) / 1000 * (SPEED_MAX - SPEED_MIN);
  return { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };
}

function clampSpeed(b: BubbleBody) {
  const sp = Math.hypot(b.vx, b.vy);
  if (sp < 1e-6) {
    const s = seedVelocity(b.groupId);
    b.vx = s.vx;
    b.vy = s.vy;
    return;
  }
  if (sp > SPEED_MAX) {
    const k = SPEED_MAX / sp;
    b.vx *= k;
    b.vy *= k;
  } else if (sp < SPEED_MIN) {
    const k = SPEED_MIN / sp;
    b.vx *= k;
    b.vy *= k;
  }
}

function clampBody(b: BubbleBody, width: number, height: number) {
  const maxX = Math.max(MARGIN, width - MARGIN - b.size);
  const maxY = Math.max(MARGIN, height - MARGIN - b.size);
  b.x = Math.min(maxX, Math.max(MARGIN, b.x));
  b.y = Math.min(maxY, Math.max(MARGIN, b.y));
}

function bounceWalls(b: BubbleBody, width: number, height: number) {
  const minX = MARGIN;
  const minY = MARGIN;
  const maxX = width - MARGIN - b.size;
  const maxY = height - MARGIN - b.size;

  if (b.x < minX) {
    b.x = minX;
    b.vx = Math.abs(b.vx);
  } else if (b.x > maxX) {
    b.x = maxX;
    b.vx = -Math.abs(b.vx);
  }

  if (b.y < minY) {
    b.y = minY;
    b.vy = Math.abs(b.vy);
  } else if (b.y > maxY) {
    b.y = maxY;
    b.vy = -Math.abs(b.vy);
  }
}

/** Separate overlaps and bounce equal-mass pairs along contact normal. */
function resolveCollisions(bodies: BubbleBody[]) {
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i];
      const b = bodies[j];
      const rax = a.size / 2;
      const rbx = b.size / 2;
      const cax = a.x + rax;
      const cay = a.y + rax;
      const cbx = b.x + rbx;
      const cby = b.y + rbx;
      let dx = cbx - cax;
      let dy = cby - cay;
      let dist = Math.hypot(dx, dy);
      const minDist = rax + rbx + GAP;
      if (dist >= minDist) continue;

      if (dist < 1e-6) {
        dx = 1;
        dy = 0;
        dist = 1;
      }
      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = minDist - dist;
      const push = overlap / 2;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;

      const vn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (vn < 0) {
        a.vx -= vn * nx;
        a.vy -= vn * ny;
        b.vx += vn * nx;
        b.vy += vn * ny;
      }
    }
  }
}

/** Keep existing motion; update sizes; spawn new groups from layout seeds. */
export function reconcileBubbleBodies(
  prev: BubbleBody[],
  placements: BubblePlacement[],
  width: number,
  height: number
): BubbleBody[] {
  if (width <= 0 || height <= 0 || placements.length === 0) return [];

  const prevById = new Map(prev.map((b) => [b.groupId, b]));
  const next: BubbleBody[] = [];

  for (const p of placements) {
    const old = prevById.get(p.groupId);
    if (old) {
      const cx = old.x + old.size / 2;
      const cy = old.y + old.size / 2;
      old.size = p.size;
      old.x = cx - old.size / 2;
      old.y = cy - old.size / 2;
      clampSpeed(old);
      clampBody(old, width, height);
      next.push(old);
    } else {
      const { vx, vy } = seedVelocity(p.groupId);
      const body: BubbleBody = {
        groupId: p.groupId,
        x: p.x,
        y: p.y,
        vx,
        vy,
        size: p.size,
      };
      clampBody(body, width, height);
      next.push(body);
    }
  }

  resolveCollisions(next);
  for (const b of next) {
    bounceWalls(b, width, height);
    clampSpeed(b);
  }
  return next;
}

/** Advance positions; bounce edges + other bubbles (mutates in place). */
export function stepBubbles(
  bodies: BubbleBody[],
  width: number,
  height: number,
  dt: number
): void {
  if (width <= 0 || height <= 0 || dt <= 0) return;

  for (const b of bodies) {
    clampSpeed(b);
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    bounceWalls(b, width, height);
  }

  resolveCollisions(bodies);
  for (const b of bodies) {
    bounceWalls(b, width, height);
    clampSpeed(b);
  }
}
