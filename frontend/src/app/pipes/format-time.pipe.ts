import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'formatTime',
  standalone: true,
})
export class FormatTimePipe implements PipeTransform {
  transform(totalSeconds: number | null | undefined): string {
    const secondsValue = typeof totalSeconds === 'number' ? totalSeconds : Number(totalSeconds);
    if (!Number.isFinite(secondsValue) || secondsValue <= 0) return '0:00';

    const minutes = Math.floor(secondsValue / 60);
    const seconds = Math.floor(secondsValue % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}

