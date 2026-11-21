import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AUDIO_API_BASE_URL } from '../audio-api.token';
import { AudioApiService, AudioProcessingParams } from './audio-api.service';

function createService(baseUrl: string): AudioApiService {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: AUDIO_API_BASE_URL, useValue: baseUrl },
    ],
  });
  return TestBed.inject(AudioApiService);
}

const NEUTRAL: AudioProcessingParams = { tempoPercent: 100, preservePitch: true, pitchSemitones: 0 };

describe('AudioApiService', () => {
  describe('stream URLs', () => {
    it('resolves an empty base URL against the page origin', () => {
      const service = createService('');

      const url = new URL(service.buildStreamUrl(NEUTRAL));

      expect(url.origin).toBe(window.location.origin);
      expect(url.pathname).toBe('/api/audio/stream');
    });

    it('uses an absolute base URL as given, ignoring a trailing slash', () => {
      const service = createService('https://api.example.com/');

      const url = new URL(service.buildStreamUrl(NEUTRAL));

      expect(url.origin).toBe('https://api.example.com');
      expect(url.pathname).toBe('/api/audio/stream');
    });

    it('resolves a path-only base URL against the page origin', () => {
      const service = createService('/backend');

      const url = new URL(service.buildStreamUrl(NEUTRAL));

      expect(url.origin).toBe(window.location.origin);
      expect(url.pathname).toBe('/backend/api/audio/stream');
    });

    it('sends tempo, preserve-pitch and pitch as query parameters', () => {
      const service = createService('');

      const url = new URL(service.buildStreamUrl({ tempoPercent: 80, preservePitch: true, pitchSemitones: -2.5 }));

      expect(url.searchParams.get('tempoPercent')).toBe('80');
      expect(url.searchParams.get('preservePitch')).toBe('true');
      expect(url.searchParams.get('pitchSemitones')).toBe('-2.5');
    });

    it('sends a zero pitch offset when pitch preservation is off', () => {
      const service = createService('');

      const url = new URL(service.buildStreamUrl({ tempoPercent: 110, preservePitch: false, pitchSemitones: 7 }));

      expect(url.searchParams.get('preservePitch')).toBe('false');
      expect(url.searchParams.get('pitchSemitones')).toBe('0');
    });

    it('adds startSeconds only when the stream is processed and the offset is positive', () => {
      const service = createService('');
      const tempoChanged: AudioProcessingParams = { ...NEUTRAL, tempoPercent: 90 };

      expect(new URL(service.buildStreamUrl(tempoChanged, 12.5)).searchParams.get('startSeconds')).toBe('12.5');
      expect(new URL(service.buildStreamUrl(tempoChanged, 0)).searchParams.has('startSeconds')).toBeFalse();
      expect(new URL(service.buildStreamUrl(NEUTRAL, 12.5)).searchParams.has('startSeconds')).toBeFalse();
    });

    it('treats a pitch change on its own as processing for startSeconds', () => {
      const service = createService('');

      const url = new URL(service.buildStreamUrl({ ...NEUTRAL, pitchSemitones: 3 }, 8));

      expect(url.searchParams.get('startSeconds')).toBe('8');
    });

    it('does not count an ignored pitch offset as processing', () => {
      const service = createService('');

      const url = new URL(service.buildStreamUrl({ tempoPercent: 100, preservePitch: false, pitchSemitones: 7 }, 8));

      expect(url.searchParams.has('startSeconds')).toBeFalse();
    });
  });

  describe('original stream URL', () => {
    it('always requests neutral processing parameters', () => {
      const service = createService('');

      const url = new URL(service.buildOriginalStreamUrl());

      expect(url.searchParams.get('tempoPercent')).toBe('100');
      expect(url.searchParams.get('preservePitch')).toBe('true');
      expect(url.searchParams.get('pitchSemitones')).toBe('0');
      expect(url.searchParams.has('startSeconds')).toBeFalse();
    });

    it('carries a positive start offset', () => {
      const service = createService('');

      expect(new URL(service.buildOriginalStreamUrl(30)).searchParams.get('startSeconds')).toBe('30');
    });
  });

  describe('docs URL', () => {
    it('points at the Swagger UI next to the API', () => {
      expect(createService('https://api.example.com/').buildDocsUrl()).toBe('https://api.example.com/swagger');
    });

    it('targets the page origin when the base URL is empty', () => {
      expect(createService('').buildDocsUrl()).toBe(`${window.location.origin}/swagger`);
    });
  });

  describe('metadata', () => {
    let http: HttpTestingController;

    function setup(baseUrl: string): AudioApiService {
      const service = createService(baseUrl);
      http = TestBed.inject(HttpTestingController);
      return service;
    }

    afterEach(() => http.verify());

    it('requests /api/audio/metadata with the processing parameters', () => {
      const service = setup('https://api.example.com');
      let received: unknown;

      service
        .getMetadata$({ tempoPercent: 75, preservePitch: true, pitchSemitones: 2 })
        .subscribe((dto) => (received = dto));

      const request = http.expectOne((req) => req.url.startsWith('https://api.example.com/api/audio/metadata'));
      const url = new URL(request.request.url);
      expect(request.request.method).toBe('GET');
      expect(url.searchParams.get('tempoPercent')).toBe('75');
      expect(url.searchParams.get('pitchSemitones')).toBe('2');

      request.flush({ sourceDurationSeconds: 125, processedDurationSeconds: 166.7 });
      expect(received).toEqual({ sourceDurationSeconds: 125, processedDurationSeconds: 166.7 });
    });

    it('emits null when the request fails', () => {
      const service = setup('');
      let received: unknown = 'unset';

      service.getMetadata$(NEUTRAL).subscribe((dto) => (received = dto));

      http
        .expectOne((req) => req.url.includes('/api/audio/metadata'))
        .flush('boom', { status: 500, statusText: 'Server Error' });
      expect(received).toBeNull();
    });
  });
});
