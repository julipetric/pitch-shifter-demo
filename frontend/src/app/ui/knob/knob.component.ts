import {
  AfterViewInit,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  arcPath,
  clamp,
  KnobRange,
  radialLinesPath,
  snapToStep,
  stepValue,
  SWEEP_END_DEG,
  SWEEP_START_DEG,
  tickMarks,
  valueToAngle,
  WheelStepper,
} from './knob-math';

/** Pointer travel, in CSS pixels, that sweeps the whole range. */
const DRAG_RANGE_PX = 240;
/** Holding Shift divides the drag speed by this factor. */
const FINE_DRAG_DIVISOR = 5;
/** Travel shorter than this is ignored, so a click or a double-click never nudges the value. */
const DRAG_THRESHOLD_PX = 3;
/** A wheel gesture commits once no wheel event has arrived for this long. */
const WHEEL_COMMIT_DELAY_MS = 250;

/** Keys of the WAI-ARIA slider pattern. */
const SLIDER_KEYS = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'PageUp', 'PageDown', 'Home', 'End'] as const;
type SliderKey = (typeof SLIDER_KEYS)[number];

function isSliderKey(key: string): key is SliderKey {
  return (SLIDER_KEYS as readonly string[]).includes(key);
}

// Face geometry in SVG user units. The face is centred on (50, 50) in a 100 × 90 view box: the
// sweep leaves the bottom of the dial open, so the box ends just below the cap. The static parts
// (cap, focus ring, pointer) are drawn in the template with the same centre.
const CENTER = 50;
const TRACK_RADIUS = 40;
const MINOR_TICK_RADII = [45.5, 48.5] as const;
const MAJOR_TICK_RADII = [44.5, 49.5] as const;

let nextId = 0;

/** Ids and references of the SVG gradients and filters, unique per knob on the page. */
function paintServers(prefix: string) {
  const server = (name: string) => ({ id: `${prefix}-${name}`, url: `url(#${prefix}-${name})` });
  return { body: server('body'), rim: server('rim'), glow: server('glow'), shadow: server('shadow') };
}

type InteractionSource = 'pointer' | 'keyboard' | 'wheel' | 'reset';

/** One continuous adjustment, from its first change to its commit. */
interface Interaction {
  readonly source: InteractionSource;
  /** Value when the adjustment began; ending on it commits nothing. */
  readonly initial: number;
  /** Value last proposed through `valueChange`. */
  latest: number;
}

/**
 * A pointer drag. Travel is measured from an anchor, a pointer position and the unsnapped value
 * there, so the value cannot drift however many moves a drag has.
 */
interface Drag {
  readonly pointerId: number;
  anchorX: number;
  anchorY: number;
  /** Unsnapped value at the anchor. */
  anchorValue: number;
  /** Whether travel from the anchor counts at the fine (Shift) speed. */
  fine: boolean;
  /** Whether the travel has passed DRAG_THRESHOLD_PX. */
  engaged: boolean;
}

/**
 * Rotary control for a numeric parameter, drawn as a hardware-style encoder.
 *
 * Fully controlled: it renders `value` exactly as given, which may lie off the step grid, and
 * proposes new values through `valueChange` while the user adjusts it. `valueCommit` follows
 * once per adjustment, when it ends on a different value than it started from.
 *
 * Drag up or right to increase (Shift for fine control), turn the wheel (Shift for large
 * steps) or use the slider keys. Double-click or the reset button returns to `neutral`.
 */
@Component({
  selector: 'app-knob',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './knob.component.html',
  styleUrl: './knob.component.scss',
  host: {
    '[class.is-disabled]': 'disabled()',
    '[class.is-dragging]': 'dragging()',
    '[style.--knob-accent]': 'accent()',
  },
})
export class KnobComponent implements AfterViewInit {
  readonly value = input.required<number>();
  readonly min = input.required<number>();
  readonly max = input.required<number>();
  readonly step = input(1);
  /** Step of PageUp, PageDown and Shift+wheel; ten steps when unset. */
  readonly largeStep = input<number>();
  /** Value the arc grows from and reset returns to; `min` when unset. */
  readonly neutral = input<number>();
  /** Visible title and accessible name. */
  readonly label = input.required<string>();
  /** Formatted value shown under the dial. */
  readonly readout = input('');
  /** Short line under the readout. */
  readonly caption = input('');
  /** Spoken value (`aria-valuetext`); the readout when empty. */
  readonly valueText = input('');
  /** CSS colour of the value arc, its glow and the pointer tip. */
  readonly accent = input('var(--c-text)');
  readonly disabled = input(false, { transform: booleanAttribute });

  /** Proposed value, on every change while an adjustment is under way. */
  readonly valueChange = output<number>();
  /** Final value of an adjustment that changed it. */
  readonly valueCommit = output<number>();

  private readonly dial = viewChild.required<ElementRef<HTMLElement>>('dial');
  private readonly destroyRef = inject(DestroyRef);

  private readonly range = computed<KnobRange>(() => ({ min: this.min(), max: this.max(), step: this.step() }));
  private readonly neutralValue = computed(() => clamp(this.neutral() ?? this.min(), this.min(), this.max()));
  private readonly largeStepSize = computed(() => this.largeStep() ?? this.step() * 10);

  protected readonly dragging = signal(false);
  protected readonly resettable = computed(() => !this.disabled() && this.value() !== this.neutralValue());
  protected readonly ariaValueText = computed(() => this.valueText() || this.readout() || null);

  protected readonly paint = paintServers(`knob-${nextId++}`);
  protected readonly trackPath = arcPath(CENTER, CENTER, TRACK_RADIUS, SWEEP_START_DEG, SWEEP_END_DEG);
  protected readonly valuePath = computed(() =>
    arcPath(CENTER, CENTER, TRACK_RADIUS, this.angleOf(this.neutralValue()), this.angleOf(this.value())),
  );
  protected readonly pointerTransform = computed(
    () => `rotate(${this.angleOf(this.value()).toFixed(2)} ${CENTER} ${CENTER})`,
  );
  protected readonly ticks = computed(() => {
    const marks = tickMarks(this.range(), this.neutralValue());
    const lines = (values: readonly number[], [inner, outer]: readonly [number, number]) =>
      radialLinesPath(CENTER, CENTER, inner, outer, values.map((value) => this.angleOf(value)));
    return {
      minor: lines(marks.minor, MINOR_TICK_RADII),
      ends: lines(marks.ends, MAJOR_TICK_RADII),
      neutral: lines([marks.neutral], MAJOR_TICK_RADII),
    };
  });

  private interaction: Interaction | null = null;
  private drag: Drag | null = null;
  private readonly wheelSteps = new WheelStepper();
  private wheelCommitTimer: ReturnType<typeof setTimeout> | undefined;

  ngAfterViewInit(): void {
    const dial = this.dial().nativeElement;
    // Non-passive, so that preventDefault keeps the page from scrolling under the knob.
    const onWheel = (event: WheelEvent) => this.onWheel(event);
    dial.addEventListener('wheel', onWheel, { passive: false });
    this.destroyRef.onDestroy(() => {
      dial.removeEventListener('wheel', onWheel);
      clearTimeout(this.wheelCommitTimer);
    });
  }

  protected onPointerDown(event: PointerEvent): void {
    if (this.disabled() || event.button !== 0 || !event.isPrimary) return;
    this.dial().nativeElement.setPointerCapture(event.pointerId);
    this.begin('pointer');
    this.drag = {
      pointerId: event.pointerId,
      anchorX: event.clientX,
      anchorY: event.clientY,
      anchorValue: clamp(this.value(), this.min(), this.max()),
      fine: event.shiftKey,
      engaged: false,
    };
    this.dragging.set(true);
  }

  protected onPointerMove(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointerId || this.disabled()) return;
    const travel = event.clientX - drag.anchorX - (event.clientY - drag.anchorY);
    if (!drag.engaged) {
      if (Math.abs(travel) < DRAG_THRESHOLD_PX) return;
      drag.engaged = true;
    }
    const { min, max } = this.range();
    const unitsPerPixel = (max - min) / DRAG_RANGE_PX / (drag.fine ? FINE_DRAG_DIVISOR : 1);
    let value = drag.anchorValue + travel * unitsPerPixel;
    // Toggling Shift changes the speed from the current position on. Pushing past an end
    // re-anchors there, so the knob responds as soon as the pointer turns back.
    if (event.shiftKey !== drag.fine || value < min || value > max) {
      value = clamp(value, min, max);
      drag.anchorX = event.clientX;
      drag.anchorY = event.clientY;
      drag.anchorValue = value;
      drag.fine = event.shiftKey;
    }
    this.begin('pointer');
    this.propose(snapToStep(value, this.range()));
  }

  /** Ends a drag on pointerup, pointercancel or lostpointercapture, whichever comes first. */
  protected onPointerEnd(event: PointerEvent): void {
    if (this.drag?.pointerId !== event.pointerId) return;
    this.drag = null;
    this.dragging.set(false);
    this.finish('pointer');
  }

  protected onKeyDown(event: KeyboardEvent): void {
    if (this.disabled() || event.altKey || event.ctrlKey || event.metaKey || !isSliderKey(event.key)) return;
    event.preventDefault();
    if (this.drag) return;
    const { latest } = this.begin('keyboard');
    this.propose(this.keyTarget(event.key, latest));
  }

  protected onKeyUp(event: KeyboardEvent): void {
    if (isSliderKey(event.key)) this.finish('keyboard');
  }

  protected onBlur(): void {
    this.finish('keyboard');
  }

  /** Returns to the neutral value as one complete adjustment: a change and its commit. */
  protected reset(): void {
    if (this.disabled()) return;
    this.begin('reset');
    this.propose(this.neutralValue());
    this.finish('reset');
  }

  protected onResetClick(): void {
    this.reset();
    // The button leaves once the value is neutral; keyboard focus stays in the control.
    this.dial().nativeElement.focus();
  }

  private onWheel(event: WheelEvent): void {
    if (this.disabled()) return;
    event.preventDefault();
    if (this.drag) return;
    const steps = this.wheelSteps.next(event);
    if (steps !== 0) {
      const { latest } = this.begin('wheel');
      const size = event.shiftKey ? this.largeStepSize() : this.step();
      this.propose(stepValue(latest, steps * size, this.range()));
    }
    if (this.interaction?.source === 'wheel') {
      clearTimeout(this.wheelCommitTimer);
      this.wheelCommitTimer = setTimeout(() => this.finish('wheel'), WHEEL_COMMIT_DELAY_MS);
    }
  }

  private keyTarget(key: SliderKey, from: number): number {
    const range = this.range();
    switch (key) {
      case 'ArrowUp':
      case 'ArrowRight':
        return stepValue(from, range.step, range);
      case 'ArrowDown':
      case 'ArrowLeft':
        return stepValue(from, -range.step, range);
      case 'PageUp':
        return stepValue(from, this.largeStepSize(), range);
      case 'PageDown':
        return stepValue(from, -this.largeStepSize(), range);
      case 'Home':
        return snapToStep(range.min, range);
      case 'End':
        return snapToStep(range.max, range);
    }
  }

  /**
   * Starts an adjustment from `source`, or continues the one under way. An adjustment from
   * another source ends, and commits, first.
   */
  private begin(source: InteractionSource): Interaction {
    const current = this.interaction;
    if (current?.source === source) return current;
    this.finish();
    const value = this.value();
    const interaction: Interaction = { source, initial: value, latest: value };
    this.interaction = interaction;
    return interaction;
  }

  private propose(value: number): void {
    const interaction = this.interaction;
    if (!interaction || value === interaction.latest) return;
    interaction.latest = value;
    this.valueChange.emit(value);
  }

  /**
   * Ends the adjustment under way, or only one from `source`, and commits a changed value. A
   * knob disabled before the end commits nothing: its parent has taken the value over.
   */
  private finish(source?: InteractionSource): void {
    const interaction = this.interaction;
    if (!interaction || (source !== undefined && interaction.source !== source)) return;
    this.interaction = null;
    clearTimeout(this.wheelCommitTimer);
    if (!this.disabled() && interaction.latest !== interaction.initial) this.valueCommit.emit(interaction.latest);
  }

  private angleOf(value: number): number {
    return valueToAngle(value, this.min(), this.max());
  }
}
