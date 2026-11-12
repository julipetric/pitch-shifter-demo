import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, DeferBlockBehavior, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { AppComponent } from './app.component';
import { AUDIO_API_BASE_URL } from './audio-api.token';

/** Minimal stand-in for the DOM event emitted by a slider thumb. */
function sliderEvent(value: number): Event {
  return { target: { valueAsNumber: value, value: `${value}` } } as unknown as Event;
}

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let component: AppComponent;
  let http: HttpTestingController;

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const audio = () => (fixture.nativeElement as HTMLElement).querySelector('audio') as HTMLAudioElement;

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

  it('shows the application title in the toolbar', () => {
    expect(text()).toContain('Pitch Shifter Demo');
  });

  it('starts paused with neutral controls and no processed waveform', () => {
    expect(text()).toContain('Play');
    expect(text()).toContain('Tempo (100%)');
    expect(text()).toContain('Pitch (0 st)');
    expect(text()).toContain('Adjust tempo or pitch to show processed waveform.');
    expect(component.isProcessingActive).toBeFalse();
  });

  it('points the audio element at the unprocessed stream initially', () => {
    const src = new URL(audio().src);

    expect(src.pathname).toBe('/api/audio/stream');
    expect(src.searchParams.get('tempoPercent')).toBe('100');
    expect(src.searchParams.get('pitchSemitones')).toBe('0');
  });

  it('shows source and processed durations once the metadata arrives', () => {
    expect(text()).toContain('Loading metadata');

    flushMetadata(125);

    expect(text()).toContain('Source: 2:05');
    expect(text()).toContain('Processed (API): 2:05');
  });

  it('stretches the displayed duration when the tempo is lowered', () => {
    flushMetadata(100);

    component.onTempoInput(sliderEvent(50));
    fixture.detectChanges();

    expect(text()).toContain('Tempo (50%)');
    expect(component.duration).toBe(200);
    expect(text()).toContain('0:00 / 3:20');
  });

  it('shows the processed waveform area once tempo or pitch changes', () => {
    component.onTempoInput(sliderEvent(90));
    fixture.detectChanges();

    expect(component.isProcessingActive).toBeTrue();
    expect(text()).not.toContain('Adjust tempo or pitch to show processed waveform.');
    expect(text()).toContain('Loading processed waveform');
  });

  it('keeps the playback position when the tempo changes', () => {
    flushMetadata(100);
    component.currentTime = 40;

    component.onTempoInput(sliderEvent(50));

    // 40 s of playback at 100% is 40 s of source, which is 80 s into a 50% stream.
    expect(component.currentTime).toBe(80);
    expect(component.seekValue).toBe(80);
  });

  it('reloads the stream a moment after the last tempo change', fakeAsync(() => {
    component.onTempoInput(sliderEvent(80));
    component.onTempoInput(sliderEvent(75));
    tick(299);
    expect(new URL(audio().src).searchParams.get('tempoPercent')).toBe('100');

    tick(1);
    fixture.detectChanges();

    expect(component.streamUrl).toContain('tempoPercent=75');
    expect(new URL(audio().src).searchParams.get('tempoPercent')).toBe('75');
    http.match(() => true);
  }));

  it('snaps the pitch slider to half-semitone steps', () => {
    component.onPitchInput(sliderEvent(3.3));
    expect(component.pitchSemitones).toBe(3.5);

    component.onPitchInput(sliderEvent(-0.2));
    expect(component.pitchSemitones).toBe(0);
  });

  it('resets the pitch offset when pitch preservation is switched off', () => {
    component.onPitchInput(sliderEvent(5));

    component.onPreservePitchChange({ checked: false } as MatSlideToggleChange);

    expect(component.preservePitch).toBeFalse();
    expect(component.pitchSemitones).toBe(0);
    expect(component.streamUrl).toContain('preservePitch=false');
  });

  it('applies the pitch immediately when the slider is released', () => {
    component.onPitchCommit(sliderEvent(2));

    expect(component.streamUrl).toContain('pitchSemitones=2');
    expect(new URL(audio().src).searchParams.get('pitchSemitones')).toBe('2');
  });

  it('tracks the volume slider on the audio element', () => {
    component.onVolumeInput(sliderEvent(0.25));

    expect(audio().volume).toBeCloseTo(0.25, 2);
  });
});
