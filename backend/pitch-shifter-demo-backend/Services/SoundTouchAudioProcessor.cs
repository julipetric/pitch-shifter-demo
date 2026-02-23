using System.IO.Pipelines;
using NAudio.Lame;
using NAudio.Wave;
using NAudio.Wave.SampleProviders;
using SoundTouch.Net.NAudioSupport;

namespace pitch_shifter_demo_backend.Services;

public class SoundTouchAudioProcessor : IAudioProcessor
{
    private const int FallbackBufferSize = 8192;

    public AudioStreamResult Process(WaveStream sourceStream, AudioProcessingParameters parameters, CancellationToken cancellationToken = default)
    {
        if (sourceStream is null) throw new ArgumentNullException(nameof(sourceStream));

        var pipe = new Pipe();

        _ = Task.Run(async () =>
        {
            Exception? failure = null;
            try
            {
                await EncodeToMp3Async(sourceStream, parameters, pipe.Writer, cancellationToken);
            }
            catch (Exception ex)
            {
                failure = ex;
            }
            finally
            {
                await pipe.Writer.CompleteAsync(failure);
            }
        }, cancellationToken);

        return new AudioStreamResult(pipe.Reader.AsStream(), "audio/mpeg", EnableRangeProcessing: false);
    }

    private static void ApplyParameters(SoundTouchWaveStream soundTouchStream, AudioProcessingParameters parameters)
    {
        var tempoRatio = parameters.TempoRatio;
        if (parameters.PreservePitch)
        {
            soundTouchStream.Tempo = (float)tempoRatio;
            soundTouchStream.Rate = 1.0f;
        }
        else
        {
            soundTouchStream.Rate = (float)tempoRatio;
            soundTouchStream.Tempo = 1.0f;
        }

        soundTouchStream.PitchSemiTones = (float)parameters.PitchSemitones;
    }

    private static async Task EncodeToMp3Async(
        WaveStream sourceStream,
        AudioProcessingParameters parameters,
        PipeWriter writer,
        CancellationToken cancellationToken)
    {
        await using var output = writer.AsStream(leaveOpen: true);
        using (sourceStream)
        using (var soundTouchStream = new SoundTouchWaveStream(sourceStream))
        {
            ApplyParameters(soundTouchStream, parameters);

            var sampleProvider = soundTouchStream.ToSampleProvider();
            var pcmProvider = new SampleToWaveProvider16(sampleProvider);

            using var mp3Writer = new LameMP3FileWriter(output, pcmProvider.WaveFormat, 128);
            var bufferSize = pcmProvider.WaveFormat.AverageBytesPerSecond / 8;
            if (bufferSize <= 0)
                bufferSize = FallbackBufferSize;
            else
                bufferSize = Math.Min(bufferSize, FallbackBufferSize);

            var buffer = new byte[bufferSize];
            int read;
            while ((read = pcmProvider.Read(buffer, 0, buffer.Length)) > 0)
            {
                cancellationToken.ThrowIfCancellationRequested();
                mp3Writer.Write(buffer, 0, read);
                await output.FlushAsync(cancellationToken);
            }

            mp3Writer.Flush();
        }
    }
}
