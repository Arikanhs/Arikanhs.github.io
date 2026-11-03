// What each shape of the home background does once it has formed (morph.ts).
// An act poses one letter at a time: from the letter's place in the shape's
// 256 x 256 box (u, v), its density and the time into the phase, it sets an
// offset (in box units) and a glow (0 to 1, toward the hover accent). A cover
// draws letters into a round hole of the shape (the bird's eyelid). Both are
// applied when drawing, so the formed shape never changes.

export interface Pose {
  dx: number;
  dy: number;
  glow: number;
  /** A color token to draw the letter in instead of the shape's ink (edges stay faint). */
  ink: string | null;
  /**
   * Lifted off the shape (the bird's wing): the letter is drawn on top of the
   * others, and the shape's mid tone fills its place, offset by (baseDx, baseDy).
   */
  lifted: boolean;
  baseDx: number;
  baseDy: number;
}

/**
 * Poses the letter at (u, v), t ms into a phase that lasts `length` ms. `density`
 * (0 to 1) is how deep in the shape the letter sits; it picked its character.
 */
export type Act = (pose: Pose, u: number, v: number, t: number, length: number, density: number) => void;

/** A letter a cover adds, in the shape's mid tone. */
export interface Glyph {
  char: string;
  /** 0 to 1, toward the hover accent. */
  glow: number;
}

/** Letters drawn into a round hole of the shape. */
export interface Cover {
  /** The hole, in the shape's box. */
  u: number;
  v: number;
  r: number;
  /**
   * The glyph for the hole's cell at (u, v), t ms into the phase, or nothing to
   * leave it empty. `cell` is a cell's height in box units.
   */
  glyph: (u: number, v: number, t: number, cell: number) => Glyph | undefined;
}

/** What a shape does in one phase: poses its letters, adds letters, or both. */
export interface Scene {
  pose?: Act;
  cover?: Cover;
}

export interface Acts {
  /** While the shape holds. */
  hold?: Scene;
  /** Instead of scattering, the letters fly off together. */
  flyOff?: Scene;
}

const TAU = Math.PI * 2;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
};
/** Rises from 0 to 1 and back over [start, start + length). */
const bump = (t: number, start: number, length: number) => {
  const s = (t - start) / length;
  return s <= 0 || s >= 1 ? 0 : Math.sin(Math.PI * s);
};

/** Wing beats: 0 (down) to 1 (up) and back, once per period. */
const beat = (t: number, period: number) => (1 - Math.cos((TAU * t) / period)) / 2;

/** How far the bird's eyelid is down (0 to 1): one wink, about 2 s into the hold. */
const wink = (t: number) => {
  if (t < 1900 || t > 2400) return 0;
  if (t < 2050) return (t - 1900) / 150;
  return t < 2250 ? 1 : (2400 - t) / 150;
};

/** Bird: sits still and winks: its eyelid (over the eye's hole) slides down and back up. */
const birdEye: Cover = {
  u: 164,
  v: 68,
  r: 12,
  glyph: (_u, v, t, cell) => {
    const lid = wink(t);
    const edge = 56 + 24 * lid;
    if (lid === 0 || v > edge) return undefined;
    // The lid's lower edge is a bright line; above it, skin like the head's.
    return v > edge - cell ? { char: '-', glow: 0.9 } : { char: '+', glow: 0 };
  },
};

/** In flight the bird tilts up, beak first (a shear about u = 128). */
const tilt = (t: number) => 0.12 * smooth(t / 400);

// The bird's wing is the bright piece in the middle of its body: its densest letters
// (the '#' and denser ones), a band along the body from about (150, 112) down to
// (93, 180). In flight it beats about its upper end, raised up and back.
const WING_DENSITY = 5.5 / 8;
const WING_ROOT = { u: 150, v: 112 };

/** Bird in flight: the body tilts up and the wing beats every 300 ms. */
const birdFlight: Act = (pose, u, v, t, _length, density) => {
  const tiltDy = -(u - 128) * tilt(t);
  pose.dy = tiltDy;
  if (density < WING_DENSITY) return;
  const a = beat(t, 300) * 1.4;
  if (a === 0) return;
  // Raised, it points toward the viewer and looks a little shorter.
  const k = 1 - 0.2 * a;
  const pu = u - WING_ROOT.u;
  const pv = v - WING_ROOT.v;
  pose.dx = (pu * Math.cos(a) - pv * Math.sin(a)) * k - pu;
  pose.dy = (pu * Math.sin(a) + pv * Math.cos(a)) * k - pv + tiltDy;
  pose.lifted = true;
  pose.baseDy = tiltDy;
};

/** The detective's hat colors, a third of the hold each. */
const HATS = ['--color-hat-white', '--color-hat-blue', '--color-hat-red'];
/** A new hat color sweeps across from the left over this long, ms. */
const HAT_WIPE = 400;

/** Detective: its hat turns white, blue, then red, tips once, then a glint sweeps across the glasses. */
const detectiveHold: Act = (pose, u, v, t, length) => {
  if (v < 130) {
    const third = length / HATS.length;
    const k = Math.min(HATS.length - 1, Math.floor(t / third));
    const wipe = -20 + ((t - k * third) / HAT_WIPE) * 300;
    pose.ink = k > 0 && u > wipe ? HATS[k - 1] : HATS[k];
    // The hat (crown and brim) lifts and tilts up from the brim's left end.
    const lift = bump(t, 900, 1400);
    const angle = -0.08 * lift;
    const du = u - 40;
    const dv = v - 120;
    pose.dx = du * Math.cos(angle) - dv * Math.sin(angle) - du;
    pose.dy = du * Math.sin(angle) + dv * Math.cos(angle) - dv - 10 * lift;
  } else if (t > 2900 && t < 3800) {
    const front = -40 + ((t - 2900) / 900) * 340;
    pose.glow = clamp01(1 - Math.abs(u - (v - 180) * 0.6 - front) / 14);
  }
};

const robotBlinking = (t: number) => (t > 1900 && t < 2050) || (t > 2250 && t < 2400);

/** Robot: the antenna light flashes, the eyes power on and blink, a scan line sweeps down. */
const robotHold: Act = (pose, u, v, t) => {
  if (v < 40) {
    pose.glow = Math.floor(t / 450) % 2 === 0 ? 0.9 : 0;
    return;
  }
  // The rims around the eye holes (centres (84, 108) and (172, 108), radius 12).
  const eye = Math.min(Math.hypot(u - 84, v - 108), Math.hypot(u - 172, v - 108));
  const on = robotBlinking(t) ? 0 : smooth((t - 200) / 500);
  let glow = on * clamp01((26 - eye) / 8);
  if (t > 3000 && t < 4400) {
    const line = 56 + ((t - 3000) / 1400) * 168;
    glow = Math.max(glow, 0.7 * clamp01(1 - Math.abs(v - line) / 6));
  }
  pose.glow = glow;
};

/** Chip: pulses of data run from the core out along the pins, two at a time. */
const chipHold: Act = (pose, u, v, t) => {
  // Square rings around the core fit the chip's outline.
  const d = Math.max(Math.abs(u - 128), Math.abs(v - 128));
  let glow = 0;
  for (const offset of [0, 550]) {
    const front = (((t + offset) % 1100) / 1100) * 135;
    glow = Math.max(glow, clamp01(1 - Math.abs(d - front) / 9));
  }
  pose.glow = glow;
};

/** By shape name (shapes.ts). */
export const ACTS: Record<string, Acts> = {
  bird: { hold: { cover: birdEye }, flyOff: { pose: birdFlight } },
  detective: { hold: { pose: detectiveHold } },
  robot: { hold: { pose: robotHold } },
  chip: { hold: { pose: chipHold } },
};
