/**
 * Maths behind the rotary knob: the value grid, the dial geometry and the wheel step counter.
 * Free of Angular, so each rule can be tested on its own.
 *
 * Angles are in degrees, clockwise from 12 o'clock, the way a dial is read.
 */

/** The sweep runs 270°, from 7:30 (the minimum) over 12 o'clock to 4:30 (the maximum). */
export const SWEEP_START_DEG = -135;
export const SWEEP_END_DEG = 135;

/** A range of values and the grid of `step` multiples, counted from `min`, they snap to. */
export interface KnobRange {
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Tolerance, in steps, that absorbs floating-point error when a value is matched to the grid. */
const GRID_EPSILON = 1e-9;

/** Upper bound on the gaps between ticks, which keeps them apart on a small dial. */
const MAX_TICK_INTERVALS = 24;

/** Wheel travel, in pixels, worth one step once a wheel gesture is under way. */
const WHEEL_PIXELS_PER_STEP = 50;

/** Pause, in milliseconds, after which the next wheel event starts a new gesture. */
const WHEEL_GESTURE_GAP_MS = 60;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Nearest value on the grid, inside the range. */
export function snapToStep(value: number, range: KnobRange): number {
  if (!(range.step > 0)) return clamp(value, range.min, range.max);
  return gridValue(Math.round((value - range.min) / range.step), range);
}

/**
 * Value on the grid `delta` away from `value`, inside the range. Increasing lands on the last
 * grid value short of the target and decreasing on the first one past it, so a value off the
 * grid moves to its neighbouring grid value and never skips over it.
 */
export function stepValue(value: number, delta: number, range: KnobRange): number {
  if (!(range.step > 0)) return clamp(value + delta, range.min, range.max);
  const position = (value + delta - range.min) / range.step;
  const index = delta > 0 ? Math.floor(position + GRID_EPSILON) : Math.ceil(position - GRID_EPSILON);
  return gridValue(index, range);
}

/**
 * Grid value at `index`, with the index kept inside the range. The result is rounded to the
 * decimals of `min` and `step`, which removes binary noise (0.1 steps give 0.3, never
 * 0.30000000000000004) and turns -0 into 0.
 */
function gridValue(index: number, { min, max, step }: KnobRange): number {
  const lastIndex = Math.max(0, Math.floor((max - min) / step + GRID_EPSILON));
  const value = min + clamp(index, 0, lastIndex) * step;
  const rounded = Number(value.toFixed(Math.max(decimalPlaces(min), decimalPlaces(step))));
  return rounded === 0 ? 0 : rounded;
}

/** Decimal places of the shortest representation of `n` that reads back as `n`. */
function decimalPlaces(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const [digits, exponent] = n.toExponential().split('e');
  const fractionDigits = digits.split('.')[1]?.length ?? 0;
  return clamp(fractionDigits - Number(exponent), 0, 20);
}

/** Position of `value` between `min` (0) and `max` (1), clamped. */
export function valueToFraction(value: number, min: number, max: number): number {
  if (!(max > min)) return 0;
  return clamp((value - min) / (max - min), 0, 1);
}

/** Angle of `value` on the sweep. Values outside the range sit at its ends. */
export function valueToAngle(value: number, min: number, max: number): number {
  return SWEEP_START_DEG + valueToFraction(value, min, max) * (SWEEP_END_DEG - SWEEP_START_DEG);
}

/** Point at `radius` and `angleDeg` around (`cx`, `cy`), in SVG coordinates (y grows downwards). */
export function polarPoint(cx: number, cy: number, radius: number, angleDeg: number): Point {
  const radians = (angleDeg * Math.PI) / 180;
  return { x: cx + radius * Math.sin(radians), y: cy - radius * Math.cos(radians) };
}

/**
 * SVG path data for the clockwise arc between two angles, given in either order. Null when the
 * angles coincide, since an arc without length draws nothing.
 */
export function arcPath(cx: number, cy: number, radius: number, angleA: number, angleB: number): string | null {
  const from = Math.min(angleA, angleB);
  const to = Math.max(angleA, angleB);
  if (!(to - from > 1e-6)) return null;
  const start = polarPoint(cx, cy, radius, from);
  const end = polarPoint(cx, cy, radius, to);
  const largeArc = to - from > 180 ? 1 : 0;
  return `M${num(start.x)} ${num(start.y)}A${radius} ${radius} 0 ${largeArc} 1 ${num(end.x)} ${num(end.y)}`;
}

/** SVG path data for one radial stroke per angle, from `inner` to `outer` radius. */
export function radialLinesPath(
  cx: number,
  cy: number,
  inner: number,
  outer: number,
  angles: readonly number[],
): string {
  return angles
    .map((angle) => {
      const a = polarPoint(cx, cy, inner, angle);
      const b = polarPoint(cx, cy, outer, angle);
      return `M${num(a.x)} ${num(a.y)}L${num(b.x)} ${num(b.y)}`;
    })
    .join('');
}

/** Values that carry a tick mark on the dial. */
export interface TickMarks {
  /** Evenly spaced values between the marked ones. */
  readonly minor: readonly number[];
  /** `min` and `max`, except one that is also the neutral value. */
  readonly ends: readonly number[];
  readonly neutral: number;
}

export function tickMarks(range: KnobRange, neutral: number): TickMarks {
  const { min, max } = range;
  const interval = tickInterval(range);
  const ends = [min, max].filter((end) => end !== neutral);
  const minor: number[] = [];
  if (interval > 0) {
    const tolerance = interval * 1e-6;
    const isMarked = (value: number) => [min, max, neutral].some((mark) => Math.abs(value - mark) < tolerance);
    const last = Math.floor(max / interval + GRID_EPSILON);
    for (let k = Math.ceil(min / interval - GRID_EPSILON); k <= last; k++) {
      const value = k * interval;
      if (!isMarked(value)) minor.push(value);
    }
  }
  return { minor, ends, neutral };
}

/**
 * Spacing of the minor ticks: the smallest 1, 2 or 5 times a power of ten that is at least one
 * step and leaves at most MAX_TICK_INTERVALS gaps across the range. Semitones from -12 to 12
 * get a tick per semitone; a tempo of 50 to 125 % one every 5 %. Ticks fall on multiples of
 * the spacing, so a round neutral value lines up with them.
 */
export function tickInterval({ min, max, step }: KnobRange): number {
  const span = max - min;
  if (!(span > 0)) return 0;
  const target = Math.max(span / MAX_TICK_INTERVALS, step > 0 ? step : 0);
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const factor = [1, 2, 5].find((f) => f * magnitude >= target * (1 - GRID_EPSILON)) ?? 10;
  return Number((factor * magnitude).toPrecision(12));
}

/** The parts of a wheel event that {@link WheelStepper} reads. */
export type WheelInput = Pick<WheelEvent, 'deltaX' | 'deltaY' | 'deltaMode' | 'timeStamp'>;

/**
 * Turns wheel events into whole steps: 1 up, -1 down, 0 while travel builds up.
 *
 * The first event of a gesture moves one step at once, so a single notch always counts,
 * whatever distance the platform reports for it. Events in quick succession (fast spins,
 * trackpads, free-spinning wheels) add up and move one step per WHEEL_PIXELS_PER_STEP, at most
 * one per event, which keeps a trackpad swipe from racing through the range.
 *
 * The dominant axis counts. Shift turns a vertical wheel into a horizontal one on most
 * platforms, and in both axes a negative delta (up or left) increases.
 */
export class WheelStepper {
  private pending = 0;
  private lastTime = Number.NEGATIVE_INFINITY;

  next(event: WheelInput): number {
    const startsGesture = event.timeStamp - this.lastTime > WHEEL_GESTURE_GAP_MS;
    this.lastTime = event.timeStamp;
    const delta = wheelPixels(event);
    if (delta === 0) return 0;
    const direction = delta < 0 ? 1 : -1;
    if (startsGesture) {
      this.pending = 0;
      return direction;
    }
    this.pending = Math.sign(this.pending) === Math.sign(delta) ? this.pending + delta : delta;
    if (Math.abs(this.pending) < WHEEL_PIXELS_PER_STEP) return 0;
    this.pending = 0;
    return direction;
  }
}

/** Travel of a wheel event along its dominant axis, in pixels. Line and page deltas count as one step. */
function wheelPixels({ deltaX, deltaY, deltaMode }: WheelInput): number {
  const delta = Math.abs(deltaY) >= Math.abs(deltaX) ? deltaY : deltaX;
  return deltaMode === 0 ? delta : Math.sign(delta) * WHEEL_PIXELS_PER_STEP;
}

/** Number written with at most three decimals, which keeps path data short and exact enough. */
function num(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}
