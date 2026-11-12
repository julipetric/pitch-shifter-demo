import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Subscription } from 'rxjs';
import { AUDIO_API_BASE_URL } from '../audio-api.token';
import { AudioFacadeService } from './audio-facade.service';

describe('AudioFacadeService', () => {
  let facade: AudioFacadeService;
  let http: HttpTestingController;
  const subscriptions: Subscription[] = [];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AUDIO_API_BASE_URL, useValue: '' },
      ],
    });
    facade = TestBed.inject(AudioFacadeService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    subscriptions.splice(0).forEach((s) => s.unsubscribe());
    http.verify();
  });

  it('starts with neutral parameters', () => {
    expect(facade.params).toEqual({ tempoPercent: 100, preservePitch: true, pitchSemitones: 0 });
    expect(facade.isProcessingActive()).toBeFalse();
  });

  it('updates one parameter without touching the others', () => {
    facade.setTempoPercent(85);

    expect(facade.params).toEqual({ tempoPercent: 85, preservePitch: true, pitchSemitones: 0 });

    facade.setPitchSemitones(-3);
    facade.setPreservePitch(false);

    expect(facade.params).toEqual({ tempoPercent: 85, preservePitch: false, pitchSemitones: -3 });
  });

  it('exposes each parameter through its own getter', () => {
    facade.setTempoPercent(120);
    facade.setPitchSemitones(4.5);
    facade.setPreservePitch(false);

    expect(facade.tempoPercent).toBe(120);
    expect(facade.pitchSemitones).toBe(4.5);
    expect(facade.preservePitch).toBeFalse();
  });

  it('reports processing when tempo or pitch differ from neutral', () => {
    facade.setTempoPercent(90);
    expect(facade.isProcessingActive()).toBeTrue();

    facade.setTempoPercent(100);
    expect(facade.isProcessingActive()).toBeFalse();

    facade.setPitchSemitones(0.5);
    expect(facade.isProcessingActive()).toBeTrue();
  });

  it('builds stream URLs from the current parameters', () => {
    facade.setTempoPercent(70);
    facade.setPitchSemitones(2);

    const url = new URL(facade.buildStreamUrl(15));

    expect(url.searchParams.get('tempoPercent')).toBe('70');
    expect(url.searchParams.get('pitchSemitones')).toBe('2');
    expect(url.searchParams.get('startSeconds')).toBe('15');
  });

  it('builds the original stream URL independently of the current parameters', () => {
    facade.setTempoPercent(70);

    const url = new URL(facade.buildOriginalStreamUrl());

    expect(url.searchParams.get('tempoPercent')).toBe('100');
    expect(url.searchParams.get('pitchSemitones')).toBe('0');
  });

  it('fetches metadata with the parameters in effect when subscribed', () => {
    facade.setTempoPercent(60);
    const received: unknown[] = [];
    subscriptions.push(facade.metadata$.subscribe((dto) => received.push(dto)));

    const request = http.expectOne((req) => req.url.includes('/api/audio/metadata'));
    expect(new URL(request.request.url).searchParams.get('tempoPercent')).toBe('60');
    request.flush({ sourceDurationSeconds: 100, processedDurationSeconds: 166.6 });

    expect(received).toEqual([{ sourceDurationSeconds: 100, processedDurationSeconds: 166.6 }]);
  });

  it('refetches metadata with the latest parameters on refresh', () => {
    subscriptions.push(facade.metadata$.subscribe());
    http.expectOne((req) => req.url.includes('/api/audio/metadata')).flush({
      sourceDurationSeconds: 100,
      processedDurationSeconds: 100,
    });

    facade.setTempoPercent(50);
    facade.refreshMetadata();

    const request = http.expectOne((req) => req.url.includes('/api/audio/metadata'));
    expect(new URL(request.request.url).searchParams.get('tempoPercent')).toBe('50');
    request.flush({ sourceDurationSeconds: 100, processedDurationSeconds: 200 });
  });

  it('cancels a superseded metadata request when a refresh arrives', () => {
    subscriptions.push(facade.metadata$.subscribe());
    const first = http.expectOne((req) => req.url.includes('/api/audio/metadata'));

    facade.setTempoPercent(110);
    facade.refreshMetadata();

    expect(first.cancelled).toBeTrue();
    http
      .expectOne((req) => req.url.includes('/api/audio/metadata'))
      .flush({ sourceDurationSeconds: 100, processedDurationSeconds: 90.9 });
  });
});
