import {
  arcPath,
  KnobRange,
  polarPoint,
  radialLinesPath,
  snapToStep,
  stepValue,
  tickInterval,
  tickMarks,
  valueToAngle,
  valueToFraction,
  WheelInput,
  WheelStepper,
} from './knob-math';

const TEMPO: KnobRange = { min: 50, max: 125, step: 1 };
const PITCH: KnobRange = { min: -12, max: 12, step: 0.5 };

describe('knob maths', () => {
  describe('snapToStep', () => {
    it('rounds to the nearest grid value', () => {
      expect(snapToStep(80.4, TEMPO)).toBe(80);
      expect(snapToStep(80.6, TEMPO)).toBe(81);
    });

    it('keeps values inside the range', () => {
      expect(snapToStep(20, TEMPO)).toBe(50);
      expect(snapToStep(400, TEMPO)).toBe(125);
    });

    it('lands exactly on half steps', () => {
      expect(snapToStep(2.4, PITCH)).toBe(2.5);
      expect(snapToStep(0.1 * 35, PITCH)).toBe(3.5);
      expect(snapToStep(-3.86, PITCH)).toBe(-4);
    });

    it('drops binary noise from decimal steps', () => {
      const tenths: KnobRange = { min: 0, max: 1, step: 0.1 };

      expect(snapToStep(0.29, tenths)).toBe(0.3);
      expect(snapToStep(0.71, tenths)).toBe(0.7);
    });

    it('returns 0 rather than -0', () => {
      // -0.9 + 3 * 0.3 is -1.1e-16 in floating point.
      expect(Object.is(snapToStep(0, { min: -0.9, max: 0.9, step: 0.3 }), 0)).toBeTrue();
    });

    it('stays on the grid when the range is not a whole number of steps', () => {
      const thirds: KnobRange = { min: 0, max: 10, step: 3 };

      expect(snapToStep(10, thirds)).toBe(9);
      expect(snapToStep(11, thirds)).toBe(9);
    });

    it('only clamps when the step is not positive', () => {
      expect(snapToStep(80.4, { min: 50, max: 125, step: 0 })).toBe(80.4);
      expect(snapToStep(130, { min: 50, max: 125, step: 0 })).toBe(125);
    });
  });

  describe('stepValue', () => {
    it('moves a grid value by the delta', () => {
      expect(stepValue(100, 1, TEMPO)).toBe(101);
      expect(stepValue(100, -10, TEMPO)).toBe(90);
      expect(stepValue(2, 0.5, PITCH)).toBe(2.5);
    });

    it('moves a value off the grid to its neighbouring grid value', () => {
      expect(stepValue(-3.86, 0.5, PITCH)).toBe(-3.5);
      expect(stepValue(-3.86, -0.5, PITCH)).toBe(-4);
      expect(stepValue(-3.86, 1, PITCH)).toBe(-3);
    });

    it('stops at the ends of the range', () => {
      expect(stepValue(124, 10, TEMPO)).toBe(125);
      expect(stepValue(125, 1, TEMPO)).toBe(125);
      expect(stepValue(51, -5, TEMPO)).toBe(50);
    });
  });

  describe('angles', () => {
    it('maps the range onto the sweep from 7:30 to 4:30', () => {
      expect(valueToAngle(-12, -12, 12)).toBe(-135);
      expect(valueToAngle(0, -12, 12)).toBe(0);
      expect(valueToAngle(12, -12, 12)).toBe(135);
      expect(valueToAngle(100, 50, 125)).toBeCloseTo(45, 10);
    });

    it('holds values outside the range at its ends', () => {
      expect(valueToAngle(-20, -12, 12)).toBe(-135);
      expect(valueToAngle(20, -12, 12)).toBe(135);
      expect(valueToFraction(5, 10, 10)).toBe(0);
    });

    it('measures angles clockwise from 12 o’clock', () => {
      const top = polarPoint(50, 50, 10, 0);
      const right = polarPoint(50, 50, 10, 90);
      const bottomLeft = polarPoint(50, 50, 10, -135);

      expect(top.x).toBeCloseTo(50, 10);
      expect(top.y).toBeCloseTo(40, 10);
      expect(right.x).toBeCloseTo(60, 10);
      expect(right.y).toBeCloseTo(50, 10);
      expect(bottomLeft.x).toBeLessThan(50);
      expect(bottomLeft.y).toBeGreaterThan(50);
    });
  });

  describe('arcPath', () => {
    it('draws a clockwise arc whatever the order of the angles', () => {
      expect(arcPath(50, 50, 10, 0, 90)).toBe('M50 40A10 10 0 0 1 60 50');
      expect(arcPath(50, 50, 10, 90, 0)).toBe('M50 40A10 10 0 0 1 60 50');
    });

    it('sets the large-arc flag beyond half a turn', () => {
      expect(arcPath(50, 50, 10, -135, 135)).toContain('A10 10 0 1 1');
    });

    it('returns null when the arc has no length', () => {
      expect(arcPath(50, 50, 10, 45, 45)).toBeNull();
    });
  });

  it('draws one radial stroke per angle', () => {
    expect(radialLinesPath(50, 50, 40, 45, [0, 90])).toBe('M50 10L50 5M90 50L95 50');
  });

  describe('ticks', () => {
    it('spaces semitone ticks one apart and tempo ticks five apart', () => {
      expect(tickInterval(PITCH)).toBe(1);
      expect(tickInterval(TEMPO)).toBe(5);
    });

    it('never spaces ticks closer than one step', () => {
      expect(tickInterval({ min: 0, max: 10, step: 2 })).toBe(2);
    });

    it('marks the ends and the neutral value apart from the minor ticks', () => {
      const pitch = tickMarks(PITCH, 0);

      expect(pitch.ends).toEqual([-12, 12]);
      expect(pitch.neutral).toBe(0);
      expect(pitch.minor.length).toBe(22);
      expect(pitch.minor).not.toContain(0);

      const tempo = tickMarks(TEMPO, 100);

      expect(tempo.minor).toEqual([55, 60, 65, 70, 75, 80, 85, 90, 95, 105, 110, 115, 120]);
    });

    it('draws a neutral value at an end as the neutral tick only', () => {
      const marks = tickMarks({ min: 0, max: 10, step: 1 }, 0);

      expect(marks.ends).toEqual([10]);
      expect(marks.neutral).toBe(0);
    });
  });

  describe('WheelStepper', () => {
    const wheel = (deltaY: number, timeStamp: number, init: Partial<WheelInput> = {}): WheelInput => ({
      deltaX: 0,
      deltaY,
      deltaMode: 0,
      timeStamp,
      ...init,
    });

    it('moves one step for a notch after a pause, whatever its size', () => {
      const stepper = new WheelStepper();

      expect(stepper.next(wheel(-100, 0))).toBe(1);
      expect(stepper.next(wheel(-4, 500))).toBe(1);
      expect(stepper.next(wheel(240, 1000))).toBe(-1);
    });

    it('moves one step per notch in a fast spin', () => {
      const stepper = new WheelStepper();
      const steps = [0, 20, 40, 60].map((time) => stepper.next(wheel(-100, time)));

      expect(steps).toEqual([1, 1, 1, 1]);
    });

    it('adds up small deltas in quick succession', () => {
      const stepper = new WheelStepper();
      const steps = Array.from({ length: 11 }, (_, i) => stepper.next(wheel(-10, i * 16)));

      expect(steps).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    });

    it('starts adding up again when the direction turns', () => {
      const stepper = new WheelStepper();

      expect(stepper.next(wheel(-40, 0))).toBe(1);
      expect(stepper.next(wheel(-40, 16))).toBe(0);
      expect(stepper.next(wheel(40, 32))).toBe(0);
      expect(stepper.next(wheel(20, 48))).toBe(-1);
    });

    it('counts line and page deltas as one step each', () => {
      const stepper = new WheelStepper();

      expect(stepper.next(wheel(-3, 0, { deltaMode: 1 }))).toBe(1);
      expect(stepper.next(wheel(-1, 10, { deltaMode: 1 }))).toBe(1);
      expect(stepper.next(wheel(1, 20, { deltaMode: 2 }))).toBe(-1);
    });

    it('reads the dominant axis, so Shift+wheel still counts', () => {
      const stepper = new WheelStepper();

      expect(stepper.next(wheel(0, 0, { deltaX: -100 }))).toBe(1);
      expect(stepper.next(wheel(0, 500, { deltaX: 100 }))).toBe(-1);
      expect(stepper.next(wheel(0, 1000))).toBe(0);
    });
  });
});
