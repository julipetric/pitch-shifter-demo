import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, OnInit } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatSliderModule } from '@angular/material/slider';
import { MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { environment } from '../environments/environment';

@Component({
    selector: 'app-root',
    imports: [MatToolbarModule, MatCardModule, MatButtonModule, MatSliderModule, MatSlideToggleModule],
    templateUrl: './app.component.html',
    styleUrl: './app.component.css'
})
export class AppComponent implements AfterViewInit, OnInit, OnDestroy {
  @ViewChild('audioRef') audioRef?: ElementRef<HTMLAudioElement>;

  title = 'Pitch Shifter Demo';
  tempoPercent = 100;
  preservePitch = true;
  pitchSemitones = 0;

  readonly tempoMin = 50;
  readonly tempoMax = 125;
  readonly pitchMin = -12;
  readonly pitchMax = 12;
  readonly pitchStep = 0.5;

  streamUrl = this.buildStreamUrl(environment.audioApiBaseUrl);
  streamOffsetSeconds = 0;
  private readonly updateDelayMs = 300;
  private pendingAutoPlay = false;
  private pendingSeekSeconds: number | null = null;
  private sourceDurationSeconds = 0;
  private readonly controlChange$ = new Subject<number>();
  private readonly destroy$ = new Subject<void>();

  isPlaying = false;
  currentTime = 0;
  duration = 0;
  seekValue = 0;
  volume = 0.8;
  isSeeking = false;

  ngOnInit(): void {
    this.controlChange$
      .pipe(
        debounceTime(this.updateDelayMs),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe((startSeconds) => {
        this.applyStreamUpdate(startSeconds);
      });
  }

  ngAfterViewInit(): void {
    const audio = this.audioRef?.nativeElement;
    if (audio) {
      audio.volume = this.volume;
    }
    this.refreshMetadata();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.controlChange$.complete();
  }

  togglePlay(): void {
    const audio = this.audioRef?.nativeElement;
    if (!audio) return;
    if (this.isPlaying) {
      audio.pause();
      return;
    }
    audio.play().catch(() => {
      this.isPlaying = false;
    });
  }

  onPlay(): void {
    this.isPlaying = true;
  }

  onPause(): void {
    this.isPlaying = false;
  }

  onEnded(): void {
    this.isPlaying = false;
    this.currentTime = this.duration;
    this.seekValue = this.duration;
  }

  onLoadedMetadata(): void {
    const audio = this.audioRef?.nativeElement;
    if (!audio) return;
    if (!this.isProcessingActive() && Number.isFinite(audio.duration) && audio.duration > 0) {
      this.sourceDurationSeconds = audio.duration;
    }
    this.updateProcessedDuration();
    if (this.pendingSeekSeconds !== null && !this.isProcessingActive()) {
      audio.currentTime = this.pendingSeekSeconds;
      this.pendingSeekSeconds = null;
    }
    if (!this.isSeeking) {
      this.seekValue = Math.min(this.seekValue, this.duration);
    }
  }

  onCanPlay(): void {
    if (!this.pendingAutoPlay) return;
    const audio = this.audioRef?.nativeElement;
    if (!audio) return;
    audio.play().then(() => {
      this.pendingAutoPlay = false;
    }).catch(() => {
      this.pendingAutoPlay = true;
    });
  }

  onTimeUpdate(): void {
    const audio = this.audioRef?.nativeElement;
    if (!audio || this.isSeeking) return;
    const absoluteTime = this.streamOffsetSeconds + audio.currentTime;
    this.currentTime = absoluteTime;
    this.seekValue = absoluteTime;
  }

  onSeekInput(event: Event): void {
    this.isSeeking = true;
    const value = this.readSliderValue(event);
    this.seekValue = value;
  }

  onSeekCommit(event: Event): void {
    const audio = this.audioRef?.nativeElement;
    if (!audio) return;
    const value = this.readSliderValue(event);
    this.seekValue = value;
    this.currentTime = value;
    if (this.isProcessingActive()) {
      this.isSeeking = false;
      this.scheduleStreamUpdate(value);
      return;
    }
    audio.currentTime = value;
    this.isSeeking = false;
  }

  onVolumeInput(event: Event): void {
    const audio = this.audioRef?.nativeElement;
    const value = this.readSliderValue(event);
    this.volume = value;
    if (audio) {
      audio.volume = value;
    }
  }

  onTempoInput(event: Event): void {
    const value = Math.round(this.readSliderValue(event));
    if (value === this.tempoPercent) return;

    const previousTempo = this.tempoPercent;
    const sourceSeconds = this.toSourceSeconds(this.currentTime, previousTempo);
    this.tempoPercent = value;
    const newProcessedSeconds = this.toProcessedSeconds(sourceSeconds, this.tempoPercent);
    this.currentTime = newProcessedSeconds;
    this.seekValue = newProcessedSeconds;
    this.updateProcessedDuration();
    this.scheduleStreamUpdate(newProcessedSeconds);
  }

  onPitchInput(event: Event): void {
    const value = this.normalizePitch(this.readSliderValue(event));
    this.pitchSemitones = value;
  }

  onPitchCommit(event: Event): void {
    const value = this.normalizePitch(this.readSliderValue(event));
    this.pitchSemitones = value;
    this.scheduleStreamUpdate(this.currentTime);
  }

  onPreservePitchChange(event: MatSlideToggleChange): void {
    this.preservePitch = event.checked;
    if (!this.preservePitch) {
      this.pitchSemitones = 0;
    }
    this.scheduleStreamUpdate(this.currentTime);
  }

  formatTime(totalSeconds: number): string {
    if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '0:00';
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  private readSliderValue(event: Event): number {
    const input = event.target as HTMLInputElement | null;
    if (!input) return 0;
    const value = Number.isFinite(input.valueAsNumber) ? input.valueAsNumber : Number(input.value);
    return Number.isFinite(value) ? value : 0;
  }

  private buildStreamUrl(baseUrl: string, startSeconds = 0): string {
    const trimmed = baseUrl.replace(/\/$/, '');
    const url = new URL(`${trimmed}/api/audio/stream`);
    url.searchParams.set('tempoPercent', `${this.tempoPercent}`);
    url.searchParams.set('preservePitch', `${this.preservePitch}`);
    const pitch = this.preservePitch ? this.pitchSemitones : 0;
    url.searchParams.set('pitchSemitones', `${pitch}`);
    if (this.isProcessingActive() && startSeconds > 0) {
      url.searchParams.set('startSeconds', `${startSeconds}`);
    }
    return url.toString();
  }

  private buildMetadataUrl(baseUrl: string): string {
    const trimmed = baseUrl.replace(/\/$/, '');
    const url = new URL(`${trimmed}/api/audio/metadata`);
    url.searchParams.set('tempoPercent', `${this.tempoPercent}`);
    url.searchParams.set('preservePitch', `${this.preservePitch}`);
    const pitch = this.preservePitch ? this.pitchSemitones : 0;
    url.searchParams.set('pitchSemitones', `${pitch}`);
    return url.toString();
  }

  private scheduleStreamUpdate(startSeconds = 0): void {
    this.controlChange$.next(Math.max(0, startSeconds));
  }

  private applyStreamUpdate(startSeconds = 0): void {
    const audio = this.audioRef?.nativeElement;
    const wasPlaying = this.isPlaying;
    const start = Math.max(0, startSeconds);
    const processing = this.isProcessingActive();
    this.streamOffsetSeconds = processing ? start : 0;
    this.pendingSeekSeconds = processing ? null : start;
    this.streamUrl = this.buildStreamUrl(environment.audioApiBaseUrl, processing ? start : 0);
    this.refreshMetadata();

    if (!audio) return;

    audio.src = this.streamUrl;
    audio.load();
    this.currentTime = start;
    this.seekValue = start;

    if (wasPlaying) {
      this.pendingAutoPlay = true;
      audio.play().then(() => {
        this.pendingAutoPlay = false;
      }).catch(() => {
        this.pendingAutoPlay = true;
      });
    }
  }

  private refreshMetadata(): void {
    const url = this.buildMetadataUrl(environment.audioApiBaseUrl);
    fetch(url)
      .then((response) => {
        if (!response.ok) return null;
        return response.json() as Promise<{ sourceDurationSeconds: number }>;
      })
      .then((data) => {
        if (!data) return;
        this.sourceDurationSeconds = Number.isFinite(data.sourceDurationSeconds)
          ? data.sourceDurationSeconds
          : this.sourceDurationSeconds;
        this.updateProcessedDuration();
      })
      .catch(() => undefined);
  }

  private isProcessingActive(): boolean {
    return this.tempoPercent !== 100 || this.pitchSemitones !== 0;
  }

  private toSourceSeconds(processedSeconds: number, tempoPercent = this.tempoPercent): number {
    return processedSeconds * (tempoPercent / 100);
  }

  private toProcessedSeconds(sourceSeconds: number, tempoPercent = this.tempoPercent): number {
    const ratio = tempoPercent / 100;
    if (ratio <= 0) return 0;
    return sourceSeconds / ratio;
  }

  private updateProcessedDuration(): void {
    if (!Number.isFinite(this.sourceDurationSeconds) || this.sourceDurationSeconds <= 0) return;
    const nextDuration = this.toProcessedSeconds(this.sourceDurationSeconds, this.tempoPercent);
    if (!Number.isFinite(nextDuration) || nextDuration <= 0) return;
    this.duration = nextDuration;
    if (!this.isSeeking) {
      this.seekValue = Math.min(this.seekValue, this.duration);
    }
  }

  private normalizePitch(value: number): number {
    if (!Number.isFinite(value)) return 0;
    const rounded = Math.round(value / this.pitchStep) * this.pitchStep;
    return Math.abs(rounded) < 0.001 ? 0 : rounded;
  }
}
