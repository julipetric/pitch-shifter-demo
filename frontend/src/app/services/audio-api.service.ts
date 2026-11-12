import { HttpClient } from '@angular/common/http';
import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';
import { AUDIO_API_BASE_URL } from '../audio-api.token';

export type AudioMetadataDto = {
  sourceDurationSeconds: number;
  processedDurationSeconds: number;
};

export type AudioProcessingParams = {
  tempoPercent: number;
  preservePitch: boolean;
  pitchSemitones: number;
};

/**
 * Builds URLs for the audio API and fetches track metadata.
 *
 * The base URL may be absolute (`https://api.example.com`), a path (`/backend`) or empty.
 * Relative values resolve against the page's own origin, so an empty base targets the server
 * that served the app.
 */
@Injectable({ providedIn: 'root' })
export class AudioApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(AUDIO_API_BASE_URL);
  private readonly document = inject(DOCUMENT);

  /** URL of the processed stream. With pitch preservation off the semitone offset is sent as 0: the pitch then follows the playback rate. */
  buildStreamUrl(params: AudioProcessingParams, startSeconds = 0): string {
    const url = this.endpoint('/api/audio/stream');
    const pitch = this.applyProcessingParams(url, params);
    if ((params.tempoPercent !== 100 || pitch !== 0) && startSeconds > 0) {
      url.searchParams.set('startSeconds', `${startSeconds}`);
    }
    return url.toString();
  }

  /** URL of the unprocessed stream, optionally starting `startSeconds` into the source. */
  buildOriginalStreamUrl(startSeconds = 0): string {
    const url = this.endpoint('/api/audio/stream');
    this.applyProcessingParams(url, { tempoPercent: 100, preservePitch: true, pitchSemitones: 0 });
    if (startSeconds > 0) {
      url.searchParams.set('startSeconds', `${startSeconds}`);
    }
    return url.toString();
  }

  /** Source and processed durations for the given parameters; `null` when the request fails. */
  getMetadata$(params: AudioProcessingParams): Observable<AudioMetadataDto | null> {
    const url = this.endpoint('/api/audio/metadata');
    this.applyProcessingParams(url, params);

    return this.http.get<AudioMetadataDto>(url.toString()).pipe(
      map((dto) => dto ?? null),
      catchError(() => of(null))
    );
  }

  private endpoint(path: string): URL {
    const base = this.baseUrl.replace(/\/+$/, '');
    return new URL(`${base}${path}`, this.document.baseURI);
  }

  /** Writes the processing query parameters and returns the pitch value that was sent. */
  private applyProcessingParams(url: URL, params: AudioProcessingParams): number {
    const pitch = params.preservePitch ? params.pitchSemitones : 0;
    url.searchParams.set('tempoPercent', `${params.tempoPercent}`);
    url.searchParams.set('preservePitch', `${params.preservePitch}`);
    url.searchParams.set('pitchSemitones', `${pitch}`);
    return pitch;
  }
}
