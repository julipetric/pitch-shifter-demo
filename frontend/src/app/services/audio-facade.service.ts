import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { shareReplay, startWith, switchMap } from 'rxjs/operators';
import { AudioApiService, AudioProcessingParams } from './audio-api.service';

const DEFAULT_PARAMS: AudioProcessingParams = {
  tempoPercent: 100,
  preservePitch: true,
  pitchSemitones: 0,
};

@Injectable({ providedIn: 'root' })
export class AudioFacadeService {
  private readonly audioApi = inject(AudioApiService);
  private readonly paramsSubject = new BehaviorSubject<AudioProcessingParams>(DEFAULT_PARAMS);
  private readonly metadataRefreshSubject = new Subject<void>();

  readonly metadata$ = this.metadataRefreshSubject.pipe(
    startWith(void 0),
    switchMap(() => this.audioApi.getMetadata$(this.params)),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  get params(): AudioProcessingParams {
    return this.paramsSubject.value;
  }

  get tempoPercent(): number {
    return this.params.tempoPercent;
  }

  get preservePitch(): boolean {
    return this.params.preservePitch;
  }

  get pitchSemitones(): number {
    return this.params.pitchSemitones;
  }

  setTempoPercent(tempoPercent: number): void {
    this.updateParams({ tempoPercent });
  }

  setPreservePitch(preservePitch: boolean): void {
    this.updateParams({ preservePitch });
  }

  setPitchSemitones(pitchSemitones: number): void {
    this.updateParams({ pitchSemitones });
  }

  refreshMetadata(): void {
    this.metadataRefreshSubject.next(void 0);
  }

  isProcessingActive(): boolean {
    return this.tempoPercent !== 100 || this.pitchSemitones !== 0;
  }

  buildStreamUrl(startSeconds = 0): string {
    return this.audioApi.buildStreamUrl(this.params, startSeconds);
  }

  buildOriginalStreamUrl(startSeconds = 0): string {
    return this.audioApi.buildOriginalStreamUrl(startSeconds);
  }

  private updateParams(partial: Partial<AudioProcessingParams>): void {
    this.paramsSubject.next({
      ...this.params,
      ...partial,
    });
  }
}
