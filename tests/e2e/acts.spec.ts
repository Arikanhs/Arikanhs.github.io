import { expect, test } from '@playwright/test';
import { ACTS, type Pose } from '../../src/components/ascii/acts';

// What the home background's shapes do once formed (acts.ts), checked directly:
// these are pure functions of a letter's place, its density and the time.

const blank = (): Pose => ({ dx: 0, dy: 0, glow: 0, ink: null, lifted: false, baseDx: 0, baseDy: 0 });

test('the bird sits still while it holds: only its eyelid moves', () => {
  expect(ACTS.bird.hold?.pose).toBeUndefined();
  expect(ACTS.bird.hold?.cover).toBeDefined();
});

test('in flight the bird beats its own wing (its densest letters) and draws no extra one', () => {
  const flight = ACTS.bird.flyOff;
  expect(flight?.cover).toBeUndefined();
  const pose = flight!.pose!;
  // A letter in the middle of the body, as part of the wing (dense) and as plain body.
  const at = (density: number, t: number) => {
    const p = blank();
    pose(p, 121, 146, t, 1500, density);
    return p;
  };
  // Over one 300 ms beat the wing swings away and back, lifted off the body.
  const up = at(0.8, 150);
  expect(up.lifted).toBe(true);
  expect(Math.hypot(up.dx, up.dy - up.baseDy)).toBeGreaterThan(20);
  const down = at(0.8, 300);
  expect(down.dx).toBeCloseTo(0, 5);
  expect(down.dy).toBeCloseTo(at(0.5, 300).dy, 5);
  // The rest of the body only tilts: exactly like the body under the lifted wing.
  for (const t of [75, 150, 225]) {
    const body = at(0.5, t);
    expect(body.lifted).toBe(false);
    expect(body.dx).toBe(0);
    expect(body.dy).toBe(at(0.8, t).baseDy);
  }
});

test("the detective's hat is white, blue, then red, a third of the hold each", () => {
  const hold = ACTS.detective.hold!.pose!;
  const inkAt = (u: number, v: number, t: number) => {
    const p = blank();
    hold(p, u, v, t, 5000, 0.8);
    return p.ink;
  };
  // The crown, early in each third.
  expect(inkAt(128, 60, 100)).toBe('--color-hat-white');
  expect(inkAt(128, 60, 2200)).toBe('--color-hat-blue');
  expect(inkAt(128, 60, 4000)).toBe('--color-hat-red');
  // A new color sweeps in from the left: just after a change, the right still has the old one.
  expect(inkAt(20, 60, 1850)).toBe('--color-hat-blue');
  expect(inkAt(240, 60, 1850)).toBe('--color-hat-white');
  // The glasses keep the detective's own ink.
  expect(inkAt(76, 180, 2200)).toBeNull();
});

