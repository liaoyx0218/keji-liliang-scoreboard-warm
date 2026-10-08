import { describe, expect, it } from "vitest";
import { reconcileBubbleBodies, seedVelocity, stepBubbles } from "./bubblePhysics";

describe("bubblePhysics", () => {
  it("seedVelocity is deterministic per groupId", () => {
    expect(seedVelocity("g1")).toEqual(seedVelocity("g1"));
    expect(seedVelocity("g1")).not.toEqual(seedVelocity("g2"));
  });

  it("reconcile keeps position for existing bodies and spawns new ones", () => {
    const prev = [
      { groupId: "a", x: 40, y: 50, vx: 10, vy: -10, size: 80 },
    ];
    const next = reconcileBubbleBodies(
      prev,
      [
        { groupId: "a", x: 0, y: 0, size: 100 },
        { groupId: "b", x: 200, y: 120, size: 64 },
      ],
      900,
      500
    );
    expect(next).toHaveLength(2);
    const a = next.find((b) => b.groupId === "a")!;
    expect(a.size).toBe(100);
    // center preserved when size changes: old center (80, 90)
    expect(a.x).toBeCloseTo(80 - 50, 5);
    expect(a.y).toBeCloseTo(90 - 50, 5);
    // speed stays in the drift band
    expect(Math.hypot(a.vx, a.vy)).toBeLessThanOrEqual(32 + 1e-6);
    expect(Math.hypot(a.vx, a.vy)).toBeGreaterThanOrEqual(14 - 1e-6);
    const b = next.find((b) => b.groupId === "b")!;
    expect(b.x).toBe(200);
    expect(b.y).toBe(120);
    expect(b.vx).not.toBe(0);
  });

  it("stepBubbles bounces off left and right edges", () => {
    const bodies = [{ groupId: "a", x: 10, y: 100, vx: -20, vy: 0, size: 64 }];
    stepBubbles(bodies, 400, 300, 1);
    expect(bodies[0].x).toBe(16);
    expect(bodies[0].vx).toBeGreaterThan(0);

    bodies[0].x = 400 - 16 - 64 + 5;
    bodies[0].vx = 30;
    stepBubbles(bodies, 400, 300, 1);
    expect(bodies[0].x).toBe(400 - 16 - 64);
    expect(bodies[0].vx).toBeLessThan(0);
  });

  it("stepBubbles bounces off top and bottom edges", () => {
    const bodies = [{ groupId: "a", x: 100, y: 10, vx: 0, vy: -15, size: 64 }];
    stepBubbles(bodies, 400, 300, 1);
    expect(bodies[0].y).toBe(16);
    expect(bodies[0].vy).toBeGreaterThan(0);

    bodies[0].y = 300 - 16 - 64 + 8;
    bodies[0].vy = 20;
    stepBubbles(bodies, 400, 300, 1);
    expect(bodies[0].y).toBe(300 - 16 - 64);
    expect(bodies[0].vy).toBeLessThan(0);
  });

  it("stepBubbles separates overlapping bubbles", () => {
    const bodies = [
      { groupId: "a", x: 100, y: 100, vx: 8, vy: 0, size: 80 },
      { groupId: "b", x: 130, y: 100, vx: -8, vy: 0, size: 80 },
    ];
    stepBubbles(bodies, 900, 500, 0.05);
    const ax = bodies[0].x + bodies[0].size / 2;
    const ay = bodies[0].y + bodies[0].size / 2;
    const bx = bodies[1].x + bodies[1].size / 2;
    const by = bodies[1].y + bodies[1].size / 2;
    const dist = Math.hypot(bx - ax, by - ay);
    expect(dist).toBeGreaterThanOrEqual(bodies[0].size / 2 + bodies[1].size / 2 + 10 - 0.5);
  });
});
