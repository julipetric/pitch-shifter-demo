import { WaveformFrequencyService } from './waveform-frequency.service';

/** Builds a mono buffer holding a sine wave. */
function sineBuffer(frequency: number, seconds: number, sampleRate = 44100, amplitude = 0.5): AudioBuffer {
  const length = Math.floor(seconds * sampleRate);
  const context = new OfflineAudioContext(1, length, sampleRate);
  const buffer = context.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let n = 0; n < length; n++) {
    data[n] = Math.sin((2 * Math.PI * frequency * n) / sampleRate) * amplitude;
  }
  return buffer;
}

describe('WaveformFrequencyService', () => {
  let service: WaveformFrequencyService;

  beforeEach(() => {
    service = new WaveformFrequencyService();
  });

  describe('frequencyToHue', () => {
    it('maps 0 Hz to red', () => {
      expect(service.frequencyToHue(0)).toBe(0);
    });

    it('maps 10 kHz and above to the end of the scale', () => {
      expect(service.frequencyToHue(10000)).toBe(280);
      expect(service.frequencyToHue(22050)).toBe(280);
    });

    it('increases monotonically with frequency', () => {
      const hues = [100, 500, 1000, 4000, 8000].map((hz) => service.frequencyToHue(hz));

      expect([...hues].sort((a, b) => a - b)).toEqual(hues);
    });

    it('clamps negative frequencies to the low end', () => {
      expect(service.frequencyToHue(-500)).toBe(0);
    });
  });

  describe('reset', () => {
    it('clears segments and restores the default normalization peak', async () => {
      await service.computeFrequencyBySegment(sineBuffer(440, 1));
      expect(service.getFrequencyBySegment().length).toBeGreaterThan(0);

      service.reset();

      expect(service.getFrequencyBySegment()).toEqual([]);
      expect(service.getNormalizationPeak()).toBe(1);
    });
  });

  describe('computeFrequencyBySegment', () => {
    it('produces one dominant frequency per segment', async () => {
      await service.computeFrequencyBySegment(sineBuffer(1000, 2));

      expect(service.getFrequencyBySegment().length).toBe(service.numFreqSegments);
    });

    it('finds the pitch of a pure tone within one FFT bin', async () => {
      const sampleRate = 44100;
      const binWidth = sampleRate / 2048;

      await service.computeFrequencyBySegment(sineBuffer(1000, 2, sampleRate));

      for (const hz of service.getFrequencyBySegment()) {
        expect(hz).toBeDefined();
        expect(Math.abs((hz as number) - 1000)).toBeLessThanOrEqual(binWidth);
      }
    });

    it('tells a low tone from a high tone', async () => {
      await service.computeFrequencyBySegment(sineBuffer(300, 2));
      const low = service.getFrequencyBySegment()[10] as number;

      await service.computeFrequencyBySegment(sineBuffer(5000, 2));
      const high = service.getFrequencyBySegment()[10] as number;

      expect(high).toBeGreaterThan(low * 5);
    });

    it('records the loudest sample as the normalization peak', async () => {
      await service.computeFrequencyBySegment(sineBuffer(440, 1, 44100, 0.8));

      expect(service.getNormalizationPeak()).toBeCloseTo(0.8, 2);
    });

    it('reports progress after each chunk', async () => {
      let chunks = 0;

      await service.computeFrequencyBySegment(sineBuffer(440, 1), { onChunkDone: () => chunks++ });

      expect(chunks).toBeGreaterThan(1);
    });

    it('stops computing once the signal is aborted', async () => {
      const controller = new AbortController();
      let chunks = 0;

      await service.computeFrequencyBySegment(sineBuffer(440, 1), {
        signal: controller.signal,
        onChunkDone: () => {
          chunks++;
          controller.abort();
        },
      });

      expect(chunks).toBe(1);
    });
  });
});
