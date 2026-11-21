import { AsyncPipe } from '@angular/common';
import {
  AfterViewChecked,
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { EMPTY, Subject, timer } from 'rxjs';
import { map, switchMap, takeUntil } from 'rxjs/operators';
import {
  describePitchForScreenReader,
  describePitchShift,
  describeTempo,
  formatSemitones,
  formatSpeed,
  formatTempo,
  tapePitchSemitones,
} from './music/intervals';
import { findPreset, PRESETS, ProcessingPreset } from './music/presets';
import { FormatTimePipe } from './pipes/format-time.pipe';
import { AudioAnalysisService } from './services/audio-analysis.service';
import { AudioApiService } from './services/audio-api.service';
import { AudioFacadeService } from './services/audio-facade.service';
import { KnobComponent } from './ui/knob/knob.component';
import { ShortcutsDialogComponent } from './ui/shortcuts/shortcuts-dialog.component';
import { SpectrumAnalyzerComponent } from './ui/spectrum/spectrum-analyzer.component';
import { StageLightDirective } from './ui/stage-light/stage-light.directive';
import { spectralColor } from './visual/spectral-palette';
import { WaveformViewComponent } from './waveform/waveform-view.component';

type ServerState = 'connecting' | 'online' | 'offline';

/** Seconds moved by the arrow-key shortcuts. */
const SEEK_STEP_SECONDS = 5;
/** Tempo change, in percent, of the tempo shortcuts. */
const TEMPO_STEP_PERCENT = 5;

/** Elements where typed characters are text input, so letter and number shortcuts stay off. */
const TEXT_ENTRY_SELECTOR = 'textarea, select, [contenteditable="true"], input:not([type="range"])';
/** Elements that give Space and the arrow keys their own meaning. */
const INTERACTIVE_SELECTOR = `${TEXT_ENTRY_SELECTOR}, input, button, a[href], [role="slider"], [role="switch"]`;

@Component({
  selector: 'app-root',
  imports: [
    AsyncPipe,
    FormatTimePipe,
    KnobComponent,
    MatSlideToggleModule,
    MatTooltipModule,
    ShortcutsDialogComponent,
    SpectrumAnalyzerComponent,
    StageLightDirective,
    WaveformViewComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements AfterViewInit, AfterViewChecked, OnInit, OnDestroy {
  @ViewChild('audioRef') audioRef?: ElementRef<HTMLAudioElement>;
  @ViewChild('lanes') lanesRef?: ElementRef<HTMLElement>;
  @ViewChild(ShortcutsDialogComponent) shortcutsDialog?: ShortcutsDialogComponent;

  private readonly audioFacade = inject(AudioFacadeService);
  private readonly analysis = inject(AudioAnalysisService);
  private readonly zone = inject(NgZone);

  readonly title = 'Pitch Shifter';
  readonly track = {
    title: 'Maple Leaf Rag',
    credit: 'Scott Joplin, 1899. Played by the U.S. Air Force Band Strolling Strings.',
  };
  readonly docsUrl = inject(AudioApiService).buildDocsUrl();
  readonly sourceCodeUrl = 'https://github.com/julipetric/pitch-shifter-demo';

  readonly tempoMin = 50;
  readonly tempoMax = 125;
  readonly pitchMin = -12;
  readonly pitchMax = 12;
  readonly pitchStep = 0.5;
  readonly presets = PRESETS;

  readonly analyser = this.analysis.analyser;
  readonly metadata$ = this.audioFacade.metadata$;

  /** Stream played by the `<audio>` element; carries `startSeconds` after a seek into processed audio. */
  streamUrl = this.audioFacade.buildStreamUrl();
  /** The original track from its start, for the original waveform. */
  readonly originalWaveformUrl = this.audioFacade.buildOriginalStreamUrl();
  /** The whole processed track for the current parameters; null while nothing is processed. */
  processedWaveformUrl: string | null = null;
  /** Position on the processed timeline where the current stream starts. */
  streamOffsetSeconds = 0;

  isPlaying = false;
  isBuffering = false;
  hasStreamError = false;
  serverState: ServerState = 'connecting';
  currentTime = 0;
  duration = 0;
  seekValue = 0;
  volume = 0.8;
  isMuted = false;
  isSeeking = false;

  private readonly updateDelayMs = 300;
  private pendingAutoPlay = false;
  private pendingSeekSeconds: number | null = null;
  private sourceDurationSeconds = 0;
  private readonly streamUpdate$ = new Subject<number | null>();
  private readonly destroy$ = new Subject<void>();
  private frameId = 0;
  private paintedOriginal = Number.NaN;
  private paintedProcessed = Number.NaN;

  get tempoPercent(): number {
    return this.audioFacade.tempoPercent;
  }

  set tempoPercent(value: number) {
    this.audioFacade.setTempoPercent(value);
  }

  get preservePitch(): boolean {
    return this.audioFacade.preservePitch;
  }

  set preservePitch(value: boolean) {
    this.audioFacade.setPreservePitch(value);
  }

  get pitchSemitones(): number {
    return this.audioFacade.pitchSemitones;
  }

  set pitchSemitones(value: number) {
    this.audioFacade.setPitchSemitones(value);
  }

  /** True when tempo or pitch differ from neutral: playback and the processed waveform use processed audio. */
  get isProcessingActive(): boolean {
    return this.audioFacade.isProcessingActive();
  }

  /** Source duration in seconds, from the metadata endpoint or the loaded original stream. */
  get sourceDuration(): number {
    return this.sourceDurationSeconds;
  }

  /** Progress 0–1 for the original waveform (source timeline). */
  get originalProgress(): number {
    return this.sourceFraction(this.currentTime);
  }

  /** Progress 0–1 for the processed waveform (playback timeline). */
  get processedProgress(): number {
    return this.processedFraction(this.currentTime);
  }

  get seekFraction(): number {
    return this.duration > 0 ? Math.min(1, this.seekValue / this.duration) : 0;
  }

  get effectiveVolume(): number {
    return this.isMuted ? 0 : this.volume;
  }

  get tempoReadout(): string {
    return formatTempo(this.tempoPercent);
  }

  get tempoCaption(): string {
    return formatSpeed(this.tempoPercent);
  }

  get tempoValueText(): string {
    return describeTempo(this.tempoPercent);
  }

  /**
   * Pitch shown by the pitch control. With preservation off the control is read-only and shows
   * the shift that the speed change itself causes.
   */
  get pitchDisplayValue(): number {
    return this.preservePitch ? this.pitchSemitones : tapePitchSemitones(this.tempoPercent);
  }

  get pitchReadout(): string {
    return formatSemitones(this.pitchDisplayValue);
  }

  get pitchCaption(): string {
    return this.preservePitch ? describePitchShift(this.pitchSemitones) : 'Follows tempo';
  }

  get pitchValueText(): string {
    const spoken = describePitchForScreenReader(this.pitchDisplayValue);
    return this.preservePitch ? spoken : `${spoken}, follows tempo`;
  }

  /** The pitch control spans the whole spectral scale: an octave down is violet, an octave up gold. */
  get pitchAccent(): string {
    return pitchColor(this.pitchDisplayValue);
  }

  get preserveHint(): string {
    return this.preservePitch ? 'Tempo changes keep the original key.' : 'Pitch follows tempo, like a tape machine.';
  }

  get activePresetId(): string | null {
    return findPreset(this.audioFacade.params)?.id ?? null;
  }

  /** Short description of the processing in effect, for the processed waveform's header. */
  get processingSummary(): string {
    const parts: string[] = [];
    if (this.tempoPercent !== 100) parts.push(`${formatTempo(this.tempoPercent)} tempo`);
    if (this.preservePitch && this.pitchSemitones !== 0) parts.push(formatSemitones(this.pitchSemitones));
    if (!this.preservePitch && this.tempoPercent !== 100) {
      parts.push(`${formatSemitones(tapePitchSemitones(this.tempoPercent))} from speed`);
    }
    return parts.join(', ');
  }

  presetColor(preset: ProcessingPreset): string {
    const { tempoPercent, preservePitch, pitchSemitones } = preset.params;
    return pitchColor(preservePitch ? pitchSemitones : tapePitchSemitones(tempoPercent));
  }

  ngOnInit(): void {
    // Each scheduled update restarts the delay; `null` cancels the pending one.
    this.streamUpdate$
      .pipe(
        switchMap((startSeconds) =>
          startSeconds === null ? EMPTY : timer(this.updateDelayMs).pipe(map(() => startSeconds))
        ),
        takeUntil(this.destroy$)
      )
      .subscribe((startSeconds) => this.applyStreamUpdate(startSeconds));
  }

  ngAfterViewInit(): void {
    const audio = this.audioRef?.nativeElement;
    if (audio) {
      audio.volume = this.volume;
    }
    this.metadata$.pipe(takeUntil(this.destroy$)).subscribe((data) => {
      this.serverState = data ? 'online' : 'offline';
      if (!data) return;
      if (Number.isFinite(data.sourceDurationSeconds) && data.sourceDurationSeconds > 0) {
        this.sourceDurationSeconds = data.sourceDurationSeconds;
        this.updateProcessedDuration();
      }
    });
  }

  /** Paused playback position follows every state change; the frame loop takes over while playing. */
  ngAfterViewChecked(): void {
    if (!this.isPlaying) {
      this.paintProgress(this.isSeeking ? this.seekValue : this.currentTime);
    }
  }

  ngOnDestroy(): void {
    this.stopFrameLoop();
    this.destroy$.next();
    this.destroy$.complete();
    this.streamUpdate$.complete();
  }

  togglePlay(): void {
    const audio = this.audioRef?.nativeElement;
    if (!audio) return;
    if (this.isPlaying) {
      audio.pause();
      return;
    }
    // Called from a click or key press, so the audio context is allowed to start.
    this.analysis.attach(audio);
    void this.analysis.resume();
    this.isBuffering = true;
    audio.play().catch(() => {
      this.isPlaying = false;
      this.isBuffering = false;
    });
  }

  onPlay(): void {
    this.isPlaying = true;
    this.startFrameLoop();
  }

  onPause(): void {
    this.isPlaying = false;
    this.isBuffering = false;
  }

  onWaiting(): void {
    this.isBuffering = true;
  }

  onPlaying(): void {
    this.isBuffering = false;
    this.hasStreamError = false;
  }

  onStreamError(): void {
    this.isBuffering = false;
    this.hasStreamError = true;
  }

  onEnded(): void {
    this.isPlaying = false;
    this.isBuffering = false;
    this.currentTime = this.duration;
    this.seekValue = this.duration;
  }

  onLoadedMetadata(): void {
    const audio = this.audioRef?.nativeElement;
    if (!audio) return;
    if (!this.isProcessingActive && Number.isFinite(audio.duration) && audio.duration > 0) {
      this.sourceDurationSeconds = audio.duration;
    }
    this.updateProcessedDuration();
    if (this.pendingSeekSeconds !== null && !this.isProcessingActive) {
      audio.currentTime = this.pendingSeekSeconds;
      this.pendingSeekSeconds = null;
    }
    if (!this.isSeeking) {
      this.seekValue = Math.min(this.seekValue, this.duration);
    }
  }

  onCanPlay(): void {
    this.hasStreamError = false;
    if (!this.isPlaying) this.isBuffering = false;
    if (!this.pendingAutoPlay) return;
    const audio = this.audioRef?.nativeElement;
    if (!audio) return;
    audio
      .play()
      .then(() => {
        this.pendingAutoPlay = false;
      })
      .catch(() => {
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
    this.seekValue = this.readSliderValue(event);
  }

  onSeekCommit(event: Event): void {
    this.seekTo(this.readSliderValue(event));
  }

  /** Seeks to a fraction of the track, as clicked on either waveform. */
  seekToFraction(fraction: number): void {
    if (this.duration <= 0) return;
    this.seekTo(Math.min(1, Math.max(0, fraction)) * this.duration);
  }

  onVolumeInput(event: Event): void {
    const value = this.readSliderValue(event);
    this.volume = value;
    this.isMuted = value === 0;
    this.syncVolume();
  }

  toggleMute(): void {
    this.isMuted = !this.isMuted;
    if (!this.isMuted && this.volume === 0) {
      this.volume = 0.8;
    }
    this.syncVolume();
  }

  /** Tempo from the tempo control; the stream follows once the control rests. */
  onTempoInput(value: number): void {
    const tempo = Math.round(value);
    if (tempo === this.tempoPercent) return;
    this.retime(tempo);
    this.scheduleStreamUpdate(this.currentTime);
  }

  /** Pitch from the pitch control while it moves; the stream follows on release. */
  onPitchInput(value: number): void {
    this.pitchSemitones = this.normalizePitch(value);
  }

  onPitchCommit(value: number): void {
    this.pitchSemitones = this.normalizePitch(value);
    this.applyStreamUpdateNow(this.currentTime);
  }

  onPreservePitchChange(event: MatSlideToggleChange): void {
    this.preservePitch = event.checked;
    if (!this.preservePitch) {
      this.pitchSemitones = 0;
    }
    this.applyStreamUpdateNow(this.currentTime);
  }

  applyPreset(preset: ProcessingPreset): void {
    const { tempoPercent, preservePitch, pitchSemitones } = preset.params;
    this.retime(tempoPercent);
    this.preservePitch = preservePitch;
    this.pitchSemitones = preservePitch ? pitchSemitones : 0;
    this.applyStreamUpdateNow(this.currentTime);
  }

  retryConnection(): void {
    this.serverState = 'connecting';
    this.hasStreamError = false;
    this.audioFacade.refreshMetadata();
    this.audioRef?.nativeElement.load();
  }

  toggleShortcuts(): void {
    this.shortcutsDialog?.toggle();
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest(TEXT_ENTRY_SELECTOR)) return;
    const onControl = !!target?.closest(INTERACTIVE_SELECTOR);

    switch (event.key) {
      case ' ':
        if (onControl) return;
        this.togglePlay();
        break;
      case 'k':
      case 'K':
        this.togglePlay();
        break;
      case 'ArrowLeft':
      case 'ArrowRight':
        if (onControl) return;
        this.seekTo(this.currentTime + (event.key === 'ArrowLeft' ? -SEEK_STEP_SECONDS : SEEK_STEP_SECONDS));
        break;
      case '[':
      case ']':
        if (!this.preservePitch) return;
        this.onPitchCommit(this.clamp(this.pitchSemitones + (event.key === '[' ? -1 : 1), this.pitchMin, this.pitchMax));
        break;
      case '-':
      case '=':
      case '+':
        this.onTempoInput(
          this.clamp(this.tempoPercent + (event.key === '-' ? -TEMPO_STEP_PERCENT : TEMPO_STEP_PERCENT), this.tempoMin, this.tempoMax)
        );
        break;
      case 'm':
      case 'M':
        this.toggleMute();
        break;
      case '?':
        this.toggleShortcuts();
        break;
      default: {
        // 1 to 6 pick the presets in display order; 0 returns to the original.
        if (!/^[0-6]$/.test(event.key)) return;
        const digit = Number(event.key);
        this.applyPreset(this.presets[Math.max(0, digit - 1)]);
      }
    }
    event.preventDefault();
  }

  private seekTo(seconds: number): void {
    const audio = this.audioRef?.nativeElement;
    if (!audio || this.duration <= 0) return;
    const value = this.clamp(seconds, 0, this.duration);
    this.seekValue = value;
    this.currentTime = value;
    this.isSeeking = false;
    if (this.isProcessingActive) {
      this.scheduleStreamUpdate(value);
      return;
    }
    audio.currentTime = value;
  }

  /** Moves the playback position onto the timeline of a new tempo, keeping the same musical moment. */
  private retime(tempoPercent: number): void {
    const previousTempo = this.tempoPercent;
    if (tempoPercent === previousTempo) return;
    const sourceSeconds = this.toSourceSeconds(this.currentTime, previousTempo);
    this.tempoPercent = tempoPercent;
    const processedSeconds = this.toProcessedSeconds(sourceSeconds, tempoPercent);
    this.currentTime = processedSeconds;
    this.seekValue = processedSeconds;
    this.updateProcessedDuration();
  }

  private syncVolume(): void {
    const audio = this.audioRef?.nativeElement;
    if (audio) {
      audio.volume = this.effectiveVolume;
    }
  }

  private readSliderValue(event: Event): number {
    const input = event.target as HTMLInputElement | null;
    if (!input) return 0;
    const value = Number.isFinite(input.valueAsNumber) ? input.valueAsNumber : Number(input.value);
    return Number.isFinite(value) ? value : 0;
  }

  private scheduleStreamUpdate(startSeconds = 0): void {
    this.streamUpdate$.next(Math.max(0, startSeconds));
  }

  private applyStreamUpdateNow(startSeconds = 0): void {
    this.streamUpdate$.next(null);
    this.applyStreamUpdate(startSeconds);
  }

  private applyStreamUpdate(startSeconds = 0): void {
    const audio = this.audioRef?.nativeElement;
    const wasPlaying = this.isPlaying;
    const start = Math.max(0, startSeconds);
    const processing = this.isProcessingActive;
    this.streamOffsetSeconds = processing ? start : 0;
    this.pendingSeekSeconds = processing ? null : start;
    this.streamUrl = this.audioFacade.buildStreamUrl(processing ? start : 0);
    this.processedWaveformUrl = processing ? this.audioFacade.buildStreamUrl(0) : null;
    this.hasStreamError = false;
    this.audioFacade.refreshMetadata();

    if (!audio) return;

    audio.src = this.streamUrl;
    audio.load();
    this.currentTime = start;
    this.seekValue = start;

    if (wasPlaying) {
      this.isBuffering = true;
      this.pendingAutoPlay = true;
      audio
        .play()
        .then(() => {
          this.pendingAutoPlay = false;
        })
        .catch(() => {
          this.pendingAutoPlay = true;
        });
    }
  }

  private startFrameLoop(): void {
    if (this.frameId !== 0) return;
    this.zone.runOutsideAngular(() => {
      const frame = () => {
        if (!this.isPlaying) {
          this.frameId = 0;
          return;
        }
        this.paintProgress(this.livePosition());
        this.frameId = requestAnimationFrame(frame);
      };
      this.frameId = requestAnimationFrame(frame);
    });
  }

  private stopFrameLoop(): void {
    if (this.frameId !== 0) {
      cancelAnimationFrame(this.frameId);
      this.frameId = 0;
    }
  }

  /** Playback position read straight from the element, between the browser's timeupdate events. */
  private livePosition(): number {
    const audio = this.audioRef?.nativeElement;
    if (this.isSeeking || !audio) return this.seekValue;
    return this.streamOffsetSeconds + audio.currentTime;
  }

  /**
   * Writes the playhead positions as CSS custom properties on the waveform container. The
   * waveforms read them in CSS, so the playhead moves every frame without change detection.
   */
  private paintProgress(position: number): void {
    const host = this.lanesRef?.nativeElement;
    if (!host) return;
    const original = this.sourceFraction(position);
    const processed = this.processedFraction(position);
    if (original !== this.paintedOriginal) {
      host.style.setProperty('--p-original', original.toFixed(5));
      this.paintedOriginal = original;
    }
    if (processed !== this.paintedProcessed) {
      host.style.setProperty('--p-processed', processed.toFixed(5));
      this.paintedProcessed = processed;
    }
  }

  private sourceFraction(processedSeconds: number): number {
    if (!Number.isFinite(this.sourceDurationSeconds) || this.sourceDurationSeconds <= 0) return 0;
    return this.clamp(this.toSourceSeconds(processedSeconds) / this.sourceDurationSeconds, 0, 1);
  }

  private processedFraction(processedSeconds: number): number {
    if (!Number.isFinite(this.duration) || this.duration <= 0) return 0;
    return this.clamp(processedSeconds / this.duration, 0, 1);
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

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
}

/** Colour of a pitch shift: ±12 semitones span the spectral scale around its middle. */
function pitchColor(semitones: number): string {
  return spectralColor(0.5 + semitones / 24);
}
