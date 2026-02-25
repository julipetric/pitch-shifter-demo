# WaveformFrequencyService

Injectable service that drives **frequency-based coloring** of the waveform: it runs chunked FFT over the audio, computes a dominant frequency per time segment, and exposes a frequency→hue mapping so the UI can draw each bar in a colour that reflects the content of that part of the track.

---

## Role

- **Input:** Decoded `AudioBuffer` (from WaveSurfer or similar).
- **Output:**  
  - `frequencyBySegment`: one dominant frequency (Hz) per segment along time.  
  - `normalizationPeak`: peak sample magnitude used to normalize bar heights.  
  - `frequencyToHue(freqHz)`: maps Hz to HSL hue for coloring.

The **waveform component** is responsible for:
- Loading audio and getting the buffer.
- Calling `computeFrequencyBySegment(buffer, options)` when the track is ready.
- Using the service’s getters and `frequencyToHue` inside its canvas `renderFunction` to draw coloured bars.

---

## How it works

### 1. Segmentation

- The track is split into **128 segments** along time (`NUM_FREQ_SEGMENTS`).
- For each segment index `s`, a sample offset is chosen so segments are evenly spread over the buffer (with step `(length - FFT_SIZE) / NUM_FREQ_SEGMENTS`).
- A **window of 2048 samples** (`FFT_SIZE`) is taken at that offset.

### 2. FFT and dominant frequency

- Each window is turned into an `AudioBuffer` and run through the **Web Audio API**: `OfflineAudioContext` → `AnalyserNode` with `fftSize = 2048`, `getFloatFrequencyData()` (decibel magnitudes per bin).
- The **bin with the largest magnitude** (excluding DC, bin 0) is found.
- That bin index is converted to Hz:  
  **`freqHz = (peakBin × sampleRate) / FFT_SIZE`**  
  and stored in `frequencyBySegment[s]`.

So the “dominant frequency” for a segment is simply the frequency of the loudest FFT bin in that time window.

### 3. Chunking and responsiveness

- Segments are processed in **chunks of 8** (`FREQ_CHUNK_SIZE`).
- After each chunk the service:
  - **Yields** to the main thread (`setTimeout(0)`).
  - Calls **`onChunkDone`** so the component can re-render the waveform with the new colours.
- An **`AbortSignal`** can be passed in; when aborted, the loop stops (e.g. when the user changes the stream or leaves the view).

### 4. Normalization

- **`computeNormalizationPeakAsync`** scans the channel in chunks to find the maximum absolute sample value.
- That value is stored as **`normalizationPeak`** and used by the component to scale bar heights so the waveform is drawn at a consistent level.

### 5. Frequency → colour

- **`frequencyToHue(freqHz)`** maps 0–4000 Hz (`MAX_FREQ_HZ`) linearly to hue (0–280°), so:
  - **Low frequencies** → red.
  - **Mid** → purple.
  - **High** → blue.
- The component uses this hue (with fixed saturation/lightness) when drawing each bar, e.g. `hsla(hue, 75%, 58%, 0.92)`.

---

## API summary

| Method / getter | Purpose |
|-----------------|--------|
| `computeFrequencyBySegment(buffer, options)` | Run chunked FFT, fill `frequencyBySegment` and `normalizationPeak`. Optional `onChunkDone`, `signal`. |
| `getFrequencyBySegment()` | Current dominant frequency (Hz) per segment. |
| `getNormalizationPeak()` | Peak magnitude used for bar height scaling. |
| `numFreqSegments` | Number of segments (128); used to map bar index → segment index. |
| `frequencyToHue(freqHz)` | Map frequency in Hz to HSL hue (0–360). |
| `reset()` | Clear internal state (e.g. when URL changes). |

---

## Provisioning

The service is **not** `providedIn: 'root'`. It is provided at the **component level** in `WaveformSnippetComponent` (`providers: [WaveformFrequencyService]`), so each waveform instance (e.g. “Original” and “Processed”) has its own state and does not overwrite the other’s frequency data.
