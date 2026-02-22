import { Component, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatSliderModule } from '@angular/material/slider';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [MatToolbarModule, MatCardModule, MatButtonModule, MatSliderModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements AfterViewInit {
  @ViewChild('audioRef') audioRef?: ElementRef<HTMLAudioElement>;

  title = 'Pitch Shifter Demo';
  readonly streamUrl = this.buildStreamUrl(environment.audioApiBaseUrl);

  isPlaying = false;
  currentTime = 0;
  duration = 0;
  seekValue = 0;
  volume = 0.8;
  isSeeking = false;

  ngAfterViewInit(): void {
    const audio = this.audioRef?.nativeElement;
    if (audio) {
      audio.volume = this.volume;
    }
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
    this.duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    if (!this.isSeeking) {
      this.seekValue = Math.min(this.seekValue, this.duration);
    }
  }

  onTimeUpdate(): void {
    const audio = this.audioRef?.nativeElement;
    if (!audio || this.isSeeking) return;
    this.currentTime = audio.currentTime;
    this.seekValue = audio.currentTime;
  }

  onSeekInput(event: Event): void {
    this.isSeeking = true;
    const value = this.readSliderValue(event);
    this.seekValue = value;
    this.currentTime = value;
  }

  onSeekCommit(event: Event): void {
    const audio = this.audioRef?.nativeElement;
    if (!audio) return;
    const value = this.readSliderValue(event);
    this.seekValue = value;
    this.currentTime = value;
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

  private buildStreamUrl(baseUrl: string): string {
    const trimmed = baseUrl.replace(/\/$/, '');
    return `${trimmed}/api/audio/stream`;
  }
}
