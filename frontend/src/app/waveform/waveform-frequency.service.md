# WaveformFrequencyService

Injectable service behind the **frequency colouring** of the waveforms: it runs a chunked FFT over a decoded track, finds the dominant frequency of each time segment, so the waveform view can draw every bar in the colour of the content under it.

---

## Role

- **Input:** a decoded `AudioBuffer`. The waveform view passes the buffer WaveSurfer decodes at 8 kHz.
- **Output:**
  - `getFrequencyBySegment()`: one dominant frequency (Hz) per segment along time; `undefined` for segments not analysed yet.
  - `numFreqSegments`: the number of segments, 128.

`WaveformViewComponent` is responsible for:
- Loading and decoding the track with WaveSurfer.
- Calling `computeFrequencyBySegment(buffer, { signal, onChunkDone })` once the track is ready, or 400 ms later with `deferColoring`.
- Repainting its canvas after each chunk. Bar `i` of `n` takes the colour of segment `floor(i × 128 / n)`.
- Aborting the run and calling `reset()` when its source changes, and aborting it when the view is destroyed.

The view sizes its bars from the peaks it draws, which are known at the first draw, so bar heights stay put while the analysis runs.

---

## How it works

### 1. Segmentation

- The first channel is split into **128 segments** along time (`NUM_FREQ_SEGMENTS`).
- Segment `s` starts at sample `min(s × step, length − 2048)`, with `step = max(1, floor((length − 2048) / 128))`, so the segments are spread evenly over the track.
- A **window of 2048 samples** (`FFT_SIZE`) is analysed at that offset. A buffer shorter than one window gives 0 Hz for every segment.

At the 8 kHz decoding rate a window spans 256 ms, the FFT bins are 3.9 Hz wide (8000 / 2048) and the highest frequency the analysis can report is 4 kHz, half the sample rate.

### 2. FFT and dominant frequency

- Each window is copied into its own `AudioBuffer` and played through an `OfflineAudioContext` into an `AnalyserNode` with `fftSize = 2048` and no smoothing; `getFloatFrequencyData()` then gives the magnitude of every bin in decibels.
- The **loudest bin**, skipping the DC bin 0, is converted to Hz:
  **`freqHz = (peakBin × sampleRate) / FFT_SIZE`**
  and stored as the segment's dominant frequency.

A silent window has no finite magnitude, so it reports 0 Hz.

### 3. Chunking and cancellation

- Segments are processed in **chunks of 8** (`FREQ_CHUNK_SIZE`), 16 chunks per track.
- After each chunk the service **yields** to the main thread (`setTimeout(0)`) and then calls **`onChunkDone`**, so the view repaints with the new colours. An exception thrown by `onChunkDone` ends the run.
- An optional **`AbortSignal`** is checked before every chunk; once it is aborted the run stops at the next check.
- A run writes its results only into the segment array it creates, so an aborted run never changes the state of a later run or of `reset()`.

---

## Frequency to colour

Colours come from `visual/spectral-palette.ts`, the scale every audio-derived colour in the app uses:

- `frequencyToSpectralPosition(hz)` places a frequency on a **logarithmic scale from 50 Hz (0) to 10 kHz (1)**. Every octave covers the same distance, about 0.13, so a pitch shift moves the colours of a track by the same amount whatever its register. Frequencies at or below 50 Hz, including the 0 Hz of silence, sit at the low end.
- `spectralColor(position)` returns a cached CSS colour from a 256-entry lookup table that runs violet, magenta, orange, gold, with lightness rising along the scale.

The waveform view draws each analysed segment in `spectralColor(frequencyToSpectralPosition(hz))` and segments not analysed yet in the neutral `#3b3b4d` (`--c-line-strong`), so the colour sweeps across the track as chunks complete. With the 8 kHz decode the reported frequencies lie between 0 Hz and 4 kHz, which covers the dominant frequencies of music: the bass and the voices.

---

## API summary

| Method / getter | Purpose |
|-----------------|--------|
| `computeFrequencyBySegment(buffer, options)` | Run the chunked FFT, filling the segment frequencies. Optional `onChunkDone` and `signal`. |
| `getFrequencyBySegment()` | Dominant frequency (Hz) per segment; `undefined` where not analysed yet. |
| `numFreqSegments` | Number of segments (128); used to map a bar to its segment. |
| `reset()` | Clear the segments. |

---

## Provisioning

The service is **not** `providedIn: 'root'`. `WaveformViewComponent` provides it (`providers: [WaveformFrequencyService]`), so each view, original and processed, has its own analysis state and never overwrites the other's.
