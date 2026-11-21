import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, DeferBlockBehavior, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { AppComponent } from './app.component';
import { AUDIO_API_BASE_URL } from './audio-api.token';
import { PRESETS } from './music/presets';

/** Minimal stand-in for the DOM event emitted by a range input. */
function sliderEvent(value: number): Event {
  return { target: { valueAsNumber: value, value: `${value}` } } as unknown as Event;
}

function preset(id: string) {
  const match = PRESETS.find((candidate) => candidate.id === id);
  if (!match) throw new Error(`Unknown preset ${id}`);
  return match;
}

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let component: AppComponent;
  let http: HttpTestingController;

  const host = () => fixture.nativeElement as HTMLElement;
  const text = () => host().textContent ?? '';
  const query = <T extends Element = HTMLElement>(selector: string) => host().querySelector(selector) as T;
  const audio = () => query<HTMLAudioElement>('audio');
  const streamParam = (name: string) => new URL(component.streamUrl).searchParams.get(name);

  /** Answers every outstanding metadata request that has not been cancelled. */
  const flushMetadata = (sourceDurationSeconds: number, tempoPercent = 100) => {
    for (const request of http.match((req) => req.url.includes('/api/audio/metadata'))) {
      if (request.cancelled) continue;
      request.flush({
        sourceDurationSeconds,
        processedDurationSeconds: sourceDurationSeconds / (tempoPercent / 100),
      });
    }
    fixture.detectChanges();
  };

  const press = (key: string, target: EventTarget = document.body) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    fixture.detectChanges();
    return event;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AppComponent],
      // Deferred waveform blocks stay on their placeholders, so no audio is decoded in these tests.
      deferBlockBehavior: DeferBlockBehavior.Manual,
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        { provide: AUDIO_API_BASE_URL, useValue: '' },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    http.match(() => true);
  });

  it('shows the application title', () => {
    expect(query('.brand-name').textContent).toContain('Pitch Shifter');
  });

  it('starts paused with neutral controls and an empty processed lane', () => {
    expect(query('.play-button').getAttribute('aria-label')).toBe('Play');
    expect(text()).toContain('100%');
    expect(text()).toContain('0 st');
    expect(text()).toContain('Turn a knob or pick a preset to hear the processed version.');
    expect(component.isProcessingActive).toBeFalse();
  });

  it('points the audio element at the unprocessed stream, requested with CORS', () => {
    const src = new URL(audio().src);

    expect(src.pathname).toBe('/api/audio/stream');
    expect(src.searchParams.get('tempoPercent')).toBe('100');
    expect(src.searchParams.get('pitchSemitones')).toBe('0');
    expect(audio().crossOrigin).toBe('anonymous');
  });

  it('reports the server online and shows the source duration once the metadata arrives', () => {
    expect(text()).toContain('Connecting');

    flushMetadata(125);

    expect(text()).toContain('Server online');
    expect(query('.lane-time').textContent).toContain('2:05');
  });

  it('explains how to recover when the server does not answer', () => {
    for (const request of http.match((req) => req.url.includes('/api/audio/metadata'))) {
      request.flush('unavailable', { status: 503, statusText: 'Service Unavailable' });
    }
    fixture.detectChanges();

    expect(text()).toContain('Server offline');
    expect(query('[role="alert"]').textContent).toContain("The audio server isn't responding");

    component.retryConnection();
    fixture.detectChanges();

    expect(text()).toContain('Connecting');
    expect(http.match((req) => req.url.includes('/api/audio/metadata')).length).toBe(1);
  });

  it('stretches the displayed duration when the tempo is lowered', () => {
    flushMetadata(100);

    component.onTempoInput(50);
    fixture.detectChanges();

    expect(component.duration).toBe(200);
    expect(query('.timecode-total').textContent).toContain('3:20');
    expect(text()).toContain('50%');
    expect(text()).toContain('0.50× speed');
  });

  it('shows the processed lane as soon as tempo or pitch changes', () => {
    component.onTempoInput(90);
    fixture.detectChanges();

    expect(component.isProcessingActive).toBeTrue();
    expect(text()).not.toContain('Turn a knob or pick a preset');
    expect(text()).toContain('Loading processed waveform');
    expect(query('.lane-summary').textContent).toContain('90% tempo');
  });

  it('keeps the playback position when the tempo changes', () => {
    flushMetadata(100);
    component.currentTime = 40;

    component.onTempoInput(50);

    // 40 s of playback at 100% is 40 s of source, which is 80 s into a 50% stream.
    expect(component.currentTime).toBe(80);
    expect(component.seekValue).toBe(80);
  });

  it('reloads the stream a moment after the last tempo change', fakeAsync(() => {
    component.onTempoInput(80);
    component.onTempoInput(75);
    tick(299);
    expect(new URL(audio().src).searchParams.get('tempoPercent')).toBe('100');

    tick(1);
    fixture.detectChanges();

    expect(streamParam('tempoPercent')).toBe('75');
    expect(new URL(audio().src).searchParams.get('tempoPercent')).toBe('75');
    http.match(() => true);
  }));

  it('applies every tempo change made before playback starts', fakeAsync(() => {
    component.onTempoInput(80);
    tick(300);
    component.onTempoInput(70);
    tick(300);

    expect(streamParam('tempoPercent')).toBe('70');
    expect(component.processedWaveformUrl).toContain('tempoPercent=70');
    http.match(() => true);
  }));

  it('loads the whole processed track for the waveform, whatever the playback offset', fakeAsync(() => {
    flushMetadata(100);
    component.currentTime = 30;

    component.onTempoInput(80);
    tick(300);

    expect(streamParam('startSeconds')).not.toBeNull();
    expect(new URL(component.processedWaveformUrl!).searchParams.has('startSeconds')).toBeFalse();
    http.match(() => true);
  }));

  it('snaps the pitch to half-semitone steps', () => {
    component.onPitchInput(3.3);
    expect(component.pitchSemitones).toBe(3.5);

    component.onPitchInput(-0.2);
    expect(component.pitchSemitones).toBe(0);
  });

  it('applies the pitch immediately when the control is released', () => {
    component.onPitchCommit(2);

    expect(streamParam('pitchSemitones')).toBe('2');
    expect(new URL(audio().src).searchParams.get('pitchSemitones')).toBe('2');
  });

  it('names the interval of the pitch shift', () => {
    component.onPitchCommit(7);
    fixture.detectChanges();

    expect(text()).toContain('+7 st');
    expect(text()).toContain('Perfect fifth up');
  });

  it('lets the pitch follow the tempo when pitch preservation is switched off', () => {
    component.onPitchInput(5);
    component.onTempoInput(50);

    component.onPreservePitchChange({ checked: false } as MatSlideToggleChange);
    fixture.detectChanges();

    expect(component.preservePitch).toBeFalse();
    expect(component.pitchSemitones).toBe(0);
    expect(streamParam('preservePitch')).toBe('false');
    expect(component.pitchDisplayValue).toBeCloseTo(-12, 6);
    expect(text()).toContain('Follows tempo');
  });

  it('applies a preset in one step and marks it active', () => {
    component.applyPreset(preset('chipmunk'));
    fixture.detectChanges();

    expect(streamParam('pitchSemitones')).toBe('12');
    expect(streamParam('tempoPercent')).toBe('100');
    expect(query('.preset[aria-pressed="true"]').textContent).toContain('Chipmunk');
  });

  it('keeps the musical position when a preset changes the tempo', () => {
    flushMetadata(100);
    component.currentTime = 30;

    component.applyPreset(preset('slow-motion'));

    expect(component.currentTime).toBeCloseTo(50, 6);
    expect(streamParam('tempoPercent')).toBe('60');
    expect(streamParam('preservePitch')).toBe('false');
    expect(Number(streamParam('startSeconds'))).toBeCloseTo(50, 6);
  });

  it('seeks to the position clicked on a waveform', () => {
    flushMetadata(100);

    component.seekToFraction(0.25);

    expect(component.currentTime).toBe(25);
    expect(component.seekValue).toBe(25);
  });

  it('writes the playhead positions for both waveforms', () => {
    flushMetadata(100);
    component.onTempoInput(50);
    component.currentTime = 50;
    fixture.detectChanges();

    const lanes = query('.lanes');
    expect(lanes.style.getPropertyValue('--p-original')).toBe('0.25000');
    expect(lanes.style.getPropertyValue('--p-processed')).toBe('0.25000');
  });

  describe('keyboard shortcuts', () => {
    it('toggles playback with Space or K', () => {
      const toggle = spyOn(component, 'togglePlay');

      expect(press(' ').defaultPrevented).toBeTrue();
      press('k');

      expect(toggle).toHaveBeenCalledTimes(2);
    });

    it('leaves Space to the focused control', () => {
      const toggle = spyOn(component, 'togglePlay');

      press(' ', query('.preset'));

      expect(toggle).not.toHaveBeenCalled();
    });

    it('moves the pitch by a semitone with the bracket keys', () => {
      press(']');
      press(']');
      press('[');

      expect(component.pitchSemitones).toBe(1);
      expect(streamParam('pitchSemitones')).toBe('1');
    });

    it('selects presets with the number keys and returns to the original with 0', () => {
      press('4');
      expect(component.activePresetId).toBe('chipmunk');

      press('0');
      expect(component.activePresetId).toBe('original');
      expect(component.isProcessingActive).toBeFalse();
    });

    it('opens and closes the shortcut list with ?', () => {
      const dialog = query('app-shortcuts-dialog');

      press('?');
      expect(dialog.matches(':popover-open')).toBeTrue();

      press('?');
      expect(dialog.matches(':popover-open')).toBeFalse();
    });

    it('ignores shortcuts combined with modifier keys', () => {
      const event = new KeyboardEvent('keydown', { key: '4', ctrlKey: true, bubbles: true, cancelable: true });
      document.body.dispatchEvent(event);

      expect(component.activePresetId).toBe('original');
      expect(event.defaultPrevented).toBeFalse();
    });
  });

  describe('volume', () => {
    it('tracks the volume slider on the audio element', () => {
      component.onVolumeInput(sliderEvent(0.25));

      expect(audio().volume).toBeCloseTo(0.25, 2);
    });

    it('mutes and restores the previous volume', () => {
      component.onVolumeInput(sliderEvent(0.4));

      component.toggleMute();
      expect(audio().volume).toBe(0);

      component.toggleMute();
      expect(audio().volume).toBeCloseTo(0.4, 2);
    });
  });
});
