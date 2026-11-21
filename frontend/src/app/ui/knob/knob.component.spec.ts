import { Component, signal } from '@angular/core';
import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { KnobComponent } from './knob.component';

/** Parent that feeds every proposed value back, the way a controlled knob is used. */
@Component({
  imports: [KnobComponent],
  template: `
    <app-knob
      [label]="label()"
      [value]="value()"
      [min]="min()"
      [max]="max()"
      [step]="step()"
      [largeStep]="largeStep()"
      [neutral]="neutral()"
      [readout]="readout()"
      [caption]="caption()"
      [valueText]="valueText()"
      [accent]="accent()"
      [disabled]="disabled()"
      (valueChange)="onChange($event)"
      (valueCommit)="commits.push($event)"
    />
  `,
})
class HostComponent {
  readonly label = signal('Tempo');
  readonly value = signal(100);
  readonly min = signal(50);
  readonly max = signal(125);
  readonly step = signal(1);
  readonly largeStep = signal<number | undefined>(undefined);
  readonly neutral = signal<number | undefined>(100);
  readonly readout = signal('100%');
  readonly caption = signal('1.00× speed');
  readonly valueText = signal('100 percent');
  readonly accent = signal('var(--c-text)');
  readonly disabled = signal(false);
  readonly changes: number[] = [];
  readonly commits: number[] = [];

  onChange(value: number): void {
    this.changes.push(value);
    this.value.set(value);
  }
}

describe('KnobComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  const element = () => fixture.nativeElement as HTMLElement;
  const knob = () => element().querySelector('app-knob') as HTMLElement;
  const dial = () => element().querySelector('[role="slider"]') as HTMLElement;
  const resetButton = () => element().querySelector<HTMLButtonElement>('button.reset');

  function update(change: () => void): void {
    change();
    fixture.detectChanges();
  }

  function usePitchRange(value: number): void {
    update(() => {
      host.min.set(-12);
      host.max.set(12);
      host.step.set(0.5);
      host.neutral.set(0);
      host.value.set(value);
    });
  }

  function keyDown(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    dial().dispatchEvent(event);
    fixture.detectChanges();
    return event;
  }

  function keyUp(key: string): void {
    dial().dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
    fixture.detectChanges();
  }

  function press(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
    const event = keyDown(key, init);
    keyUp(key);
    return event;
  }

  function pointer(type: string, x: number, y: number, init: PointerEventInit = {}): void {
    const event = new PointerEvent(type, {
      pointerId: 1,
      isPrimary: true,
      button: 0,
      clientX: x,
      clientY: y,
      bubbles: true,
      cancelable: true,
      ...init,
    });
    dial().dispatchEvent(event);
    fixture.detectChanges();
  }

  function wheel(init: WheelEventInit): WheelEvent {
    const event = new WheelEvent('wheel', { deltaMode: 0, bubbles: true, cancelable: true, ...init });
    dial().dispatchEvent(event);
    fixture.detectChanges();
    return event;
  }

  function doubleClick(): void {
    dial().dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    fixture.detectChanges();
  }

  beforeEach(() => {
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('accessibility', () => {
    it('exposes a vertical slider named after the label', () => {
      expect(dial().getAttribute('tabindex')).toBe('0');
      expect(dial().getAttribute('aria-label')).toBe('Tempo');
      expect(dial().getAttribute('aria-valuemin')).toBe('50');
      expect(dial().getAttribute('aria-valuemax')).toBe('125');
      expect(dial().getAttribute('aria-valuenow')).toBe('100');
      expect(dial().getAttribute('aria-valuetext')).toBe('100 percent');
      expect(dial().getAttribute('aria-orientation')).toBe('vertical');
      expect(dial().hasAttribute('aria-disabled')).toBeFalse();
      expect(dial().querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    });

    it('follows changes to the inputs', () => {
      update(() => {
        host.label.set('Speed');
        host.min.set(25);
        host.max.set(200);
        host.value.set(80);
        host.valueText.set('80 percent');
      });

      expect(dial().getAttribute('aria-label')).toBe('Speed');
      expect(dial().getAttribute('aria-valuemin')).toBe('25');
      expect(dial().getAttribute('aria-valuemax')).toBe('200');
      expect(dial().getAttribute('aria-valuenow')).toBe('80');
      expect(dial().getAttribute('aria-valuetext')).toBe('80 percent');
    });

    it('speaks the readout when no value text is given', () => {
      update(() => host.valueText.set(''));

      expect(dial().getAttribute('aria-valuetext')).toBe('100%');
    });

    it('shows the label, readout and caption', () => {
      expect(element().querySelector('.label')?.textContent).toBe('Tempo');
      expect(element().querySelector('.readout')?.textContent).toBe('100%');
      expect(element().querySelector('.caption')?.textContent).toBe('1.00× speed');
    });

    it('shows a value off the step grid as given', () => {
      usePitchRange(-3.86);

      expect(dial().getAttribute('aria-valuenow')).toBe('-3.86');
      expect(host.changes).toEqual([]);
    });
  });

  describe('keyboard', () => {
    it('steps with the arrow keys', () => {
      for (const key of ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowDown', 'ArrowLeft']) press(key);

      expect(host.changes).toEqual([101, 102, 101, 100, 99]);
    });

    it('moves ten steps with PageUp and PageDown by default', () => {
      press('PageUp');
      press('PageDown');
      press('PageDown');

      expect(host.changes).toEqual([110, 100, 90]);
    });

    it('moves by the large step when one is set', () => {
      update(() => host.largeStep.set(5));
      press('PageUp');

      expect(host.changes).toEqual([105]);
    });

    it('jumps to the ends with Home and End', () => {
      press('Home');
      press('End');

      expect(host.changes).toEqual([50, 125]);
    });

    it('keeps the slider keys from scrolling the page', () => {
      for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End']) {
        expect(press(key).defaultPrevented).withContext(key).toBeTrue();
      }
      expect(press('Tab').defaultPrevented).toBeFalse();
    });

    it('commits once, when the key is released', () => {
      keyDown('ArrowUp');
      keyDown('ArrowUp');
      keyDown('ArrowUp');

      expect(host.changes).toEqual([101, 102, 103]);
      expect(host.commits).toEqual([]);

      keyUp('ArrowUp');

      expect(host.commits).toEqual([103]);
    });

    it('commits when focus leaves during a key press', () => {
      keyDown('ArrowDown');
      dial().dispatchEvent(new FocusEvent('blur'));
      fixture.detectChanges();

      expect(host.commits).toEqual([99]);
    });

    it('leaves shortcuts with Alt, Ctrl or Meta to the browser', () => {
      const back = press('ArrowLeft', { altKey: true });
      press('Home', { ctrlKey: true });
      press('End', { metaKey: true });

      expect(back.defaultPrevented).toBeFalse();
      expect(host.changes).toEqual([]);
    });
  });

  describe('range', () => {
    it('clamps at the ends', () => {
      update(() => host.value.set(121));
      press('PageUp');
      press('ArrowUp');
      update(() => host.value.set(52));
      press('PageDown');
      press('ArrowDown');

      expect(host.changes).toEqual([125, 50]);
      expect(host.commits).toEqual([125, 50]);
    });

    it('lands exactly on half steps', () => {
      usePitchRange(2);
      for (const key of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowDown']) press(key);

      expect(host.changes).toEqual([2.5, 3, 2.5, 2, 1.5]);
    });

    it('steps from a value off the grid to its neighbouring grid values', () => {
      usePitchRange(-3.86);
      press('ArrowUp');
      update(() => host.value.set(-3.86));
      press('ArrowDown');

      expect(host.changes).toEqual([-3.5, -4]);
    });
  });

  describe('pointer drag', () => {
    beforeEach(() => {
      spyOn(dial(), 'setPointerCapture');
    });

    it('changes the value in proportion to the travel', () => {
      // 75 % of tempo over 240 px: 3.2 px per percent.
      pointer('pointerdown', 100, 100);
      pointer('pointermove', 100, 68);

      expect(host.value()).toBe(110);

      pointer('pointermove', 100, 148);

      expect(host.value()).toBe(85);

      pointer('pointerup', 100, 148);

      expect(dial().setPointerCapture).toHaveBeenCalledWith(1);
      expect(host.changes).toEqual([110, 85]);
      expect(host.commits).toEqual([85]);
    });

    it('counts travel to the right as an increase', () => {
      pointer('pointerdown', 100, 100);
      pointer('pointermove', 132, 100);
      pointer('pointerup', 132, 100);

      expect(host.commits).toEqual([110]);
    });

    it('drags five times finer with Shift', () => {
      pointer('pointerdown', 100, 100, { shiftKey: true });
      pointer('pointermove', 100, 52, { shiftKey: true });

      expect(host.value()).toBe(103);
    });

    it('keeps the value when Shift is pressed mid-drag and continues finer', () => {
      pointer('pointerdown', 100, 100);
      pointer('pointermove', 100, 68);
      pointer('pointermove', 100, 68, { shiftKey: true });

      expect(host.value()).toBe(110);

      pointer('pointermove', 100, 52, { shiftKey: true });

      expect(host.value()).toBe(111);
    });

    it('ignores travel shorter than the drag threshold', () => {
      pointer('pointerdown', 100, 100);
      pointer('pointermove', 102, 100);
      pointer('pointerup', 102, 100);

      expect(host.changes).toEqual([]);
      expect(host.commits).toEqual([]);
    });

    it('responds as soon as the pointer turns back from an end', () => {
      update(() => host.value.set(120));
      pointer('pointerdown', 100, 100);
      pointer('pointermove', 100, 0);

      expect(host.value()).toBe(125);

      pointer('pointermove', 100, 16);

      expect(host.value()).toBe(120);
    });

    it('lands exactly on half steps', () => {
      usePitchRange(0);
      // 24 semitones over 240 px: 0.1 per pixel.
      pointer('pointerdown', 100, 100);
      pointer('pointermove', 100, 65);

      expect(host.value()).toBe(3.5);

      pointer('pointermove', 100, 77);

      expect(host.value()).toBe(2.5);
    });

    it('only drags with the primary button', () => {
      pointer('pointerdown', 100, 100, { button: 2 });
      pointer('pointermove', 100, 40);

      expect(dial().setPointerCapture).not.toHaveBeenCalled();
      expect(host.changes).toEqual([]);
    });

    it('marks the host while the pointer is down', () => {
      pointer('pointerdown', 100, 100);

      expect(knob().classList.contains('is-dragging')).toBeTrue();

      pointer('pointerup', 100, 100);

      expect(knob().classList.contains('is-dragging')).toBeFalse();
    });

    it('commits when the browser cancels the drag', () => {
      pointer('pointerdown', 100, 100);
      pointer('pointermove', 100, 68);
      pointer('pointercancel', 100, 68);

      expect(host.commits).toEqual([110]);
      expect(knob().classList.contains('is-dragging')).toBeFalse();
    });
  });

  describe('wheel', () => {
    it('steps once per notch and commits once the wheel rests', fakeAsync(() => {
      wheel({ deltaY: -100 });

      expect(host.changes).toEqual([101]);

      tick(200);
      wheel({ deltaY: -100 });

      expect(host.changes).toEqual([101, 102]);

      tick(249);

      expect(host.commits).toEqual([]);

      tick(1);

      expect(host.commits).toEqual([102]);
    }));

    it('turns the value down when scrolling down', fakeAsync(() => {
      wheel({ deltaY: 100 });
      tick(250);

      expect(host.changes).toEqual([99]);
      expect(host.commits).toEqual([99]);
    }));

    it('moves by the large step with Shift, on either axis', fakeAsync(() => {
      wheel({ deltaY: -100, shiftKey: true });
      wheel({ deltaX: -100, shiftKey: true });
      tick(250);

      expect(host.changes).toEqual([110, 120]);
      expect(host.commits).toEqual([120]);
    }));

    it('keeps the page from scrolling, also at the ends of the range', fakeAsync(() => {
      update(() => host.value.set(125));

      expect(wheel({ deltaY: -100 }).defaultPrevented).toBeTrue();
      expect(host.changes).toEqual([]);

      tick(250);

      expect(host.commits).toEqual([]);
    }));

    it('drops the pending commit when the knob is disabled', fakeAsync(() => {
      wheel({ deltaY: -100 });
      update(() => host.disabled.set(true));
      tick(250);

      expect(host.changes).toEqual([101]);
      expect(host.commits).toEqual([]);
    }));
  });

  describe('reset', () => {
    it('returns to neutral on double-click, with a change and a commit', () => {
      update(() => host.value.set(80));
      doubleClick();

      expect(host.changes).toEqual([100]);
      expect(host.commits).toEqual([100]);
    });

    it('offers a reset button that returns to neutral and keeps focus on the dial', () => {
      update(() => host.value.set(80));
      const button = resetButton();

      expect(button?.getAttribute('aria-label')).toBe('Reset Tempo');
      expect(button?.title).toContain('Reset Tempo');

      button?.click();
      fixture.detectChanges();

      expect(host.changes).toEqual([100]);
      expect(host.commits).toEqual([100]);
      expect(resetButton()).toBeNull();
      expect(document.activeElement).toBe(dial());
    });

    it('shows no reset button at the neutral value', () => {
      expect(resetButton()).toBeNull();
    });

    it('emits nothing for a double-click at the neutral value', () => {
      doubleClick();

      expect(host.changes).toEqual([]);
      expect(host.commits).toEqual([]);
    });

    it('resets to the minimum when no neutral value is set', () => {
      update(() => {
        host.neutral.set(undefined);
        host.value.set(80);
      });
      doubleClick();

      expect(host.commits).toEqual([50]);
    });
  });

  describe('disabled', () => {
    beforeEach(() => {
      update(() => {
        host.disabled.set(true);
        host.value.set(80);
      });
    });

    it('is marked disabled and leaves the tab order', () => {
      expect(dial().getAttribute('aria-disabled')).toBe('true');
      expect(dial().getAttribute('tabindex')).toBe('-1');
      expect(knob().classList.contains('is-disabled')).toBeTrue();
      expect(resetButton()).toBeNull();
    });

    it('ignores keys, the wheel, drags and double-clicks', fakeAsync(() => {
      spyOn(dial(), 'setPointerCapture');
      const key = press('ArrowUp');
      const scroll = wheel({ deltaY: -100 });
      pointer('pointerdown', 100, 100);
      pointer('pointermove', 100, 0);
      pointer('pointerup', 100, 0);
      doubleClick();
      tick(250);

      expect(key.defaultPrevented).toBeFalse();
      expect(scroll.defaultPrevented).toBeFalse();
      expect(dial().setPointerCapture).not.toHaveBeenCalled();
      expect(host.changes).toEqual([]);
      expect(host.commits).toEqual([]);
    }));
  });

  describe('face', () => {
    it('draws the value arc only away from the neutral value', () => {
      expect(element().querySelector('path.value')).toBeNull();

      update(() => host.value.set(110));
      const arc = element().querySelector('path.value');

      expect(arc).toBeInstanceOf(SVGPathElement);
      expect(arc?.getAttribute('d')).toMatch(/^M[\d.]+ [\d.]+A40 40 0 0 1 [\d.]+ [\d.]+$/);
    });

    it('turns the pointer to the value', () => {
      const pointerTransform = () => element().querySelector('.cap > g')?.getAttribute('transform');

      update(() => host.value.set(50));

      expect(pointerTransform()).toBe('rotate(-135.00 50 50)');

      update(() => host.value.set(125));

      expect(pointerTransform()).toBe('rotate(135.00 50 50)');
    });

    it('takes the accent colour from its input', () => {
      expect(knob().style.getPropertyValue('--knob-accent')).toBe('var(--c-text)');

      update(() => host.accent.set('#ff9044'));

      expect(knob().style.getPropertyValue('--knob-accent')).toBe('#ff9044');
    });
  });
});
