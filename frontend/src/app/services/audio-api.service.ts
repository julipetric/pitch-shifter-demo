import { HttpClient } from '@angular/common/http';
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

@Injectable({ providedIn: 'root' })
export class AudioApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(AUDIO_API_BASE_URL);

  buildStreamUrl(params: AudioProcessingParams, startSeconds = 0): string {
    const trimmed = this.baseUrl.replace(/\/$/, '');
    const url = new URL(`${trimmed}/api/audio/stream`);
    url.searchParams.set('tempoPercent', `${params.tempoPercent}`);
    url.searchParams.set('preservePitch', `${params.preservePitch}`);
    const pitch = params.preservePitch ? params.pitchSemitones : 0;
    url.searchParams.set('pitchSemitones', `${pitch}`);
    if ((params.tempoPercent !== 100 || pitch !== 0) && startSeconds > 0) {
      url.searchParams.set('startSeconds', `${startSeconds}`);
    }
    return url.toString();
  }

  buildOriginalStreamUrl(startSeconds = 0): string {
    const trimmed = this.baseUrl.replace(/\/$/, '');
    const url = new URL(`${trimmed}/api/audio/stream`);
    url.searchParams.set('tempoPercent', '100');
    url.searchParams.set('preservePitch', 'true');
    url.searchParams.set('pitchSemitones', '0');
    if (startSeconds > 0) {
      url.searchParams.set('startSeconds', `${startSeconds}`);
    }
    return url.toString();
  }

  getMetadata$(params: AudioProcessingParams): Observable<AudioMetadataDto | null> {
    const trimmed = this.baseUrl.replace(/\/$/, '');
    const url = new URL(`${trimmed}/api/audio/metadata`);
    url.searchParams.set('tempoPercent', `${params.tempoPercent}`);
    url.searchParams.set('preservePitch', `${params.preservePitch}`);
    const pitch = params.preservePitch ? params.pitchSemitones : 0;
    url.searchParams.set('pitchSemitones', `${pitch}`);

    // Using responseType 'json' with HttpClient gives typed JSON parsing + cancellation.
    return this.http.get<AudioMetadataDto>(url.toString()).pipe(
      map((dto) => dto ?? null),
      catchError(() => of(null))
    );
  }
}

