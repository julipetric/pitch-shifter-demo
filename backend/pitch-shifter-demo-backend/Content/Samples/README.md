# Sample audio

The API streams the first supported file in this folder (or `Audio:DefaultFileName`, if set).
Supported extensions: `.mp3`, `.wav`, `.wave`, `.ogg`, `.m4a`, `.aac`. MP3 and WAV are decoded
for processing; the other formats are served as-is only when no processing is requested.

If no usable file is found and `Audio:EnableFallbackTone` is `true` (the default), the API
returns a generated 5-second 440 Hz tone so the app still has something to play.

## Bundled sample

`maple-leaf-rag.mp3` — *Maple Leaf Rag* (Scott Joplin, 1899), performed by the Strolling
Strings of the United States Air Force Band, from *Air Force Strolling Strings 40th
Anniversary* (1994). Re-encoded to 160 kbps MP3 for a smaller repository footprint.

- **License:** public domain. The recording is a work of the U.S. federal government
  (17 U.S.C. § 105) and the composition's copyright has expired.
- **Source:** [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Maple_Leaf_Rag_-_Strolling_Strings_-_United_States_Air_Force_Band.mp3),
  originally published by the [U.S. Air Force Band](https://www.music.af.mil/Multimedia/Music/Public-Domain-Music/).

Keep demo files short: the processed stream is rendered on the fly for every request.
