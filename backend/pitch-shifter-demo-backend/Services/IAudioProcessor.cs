using NAudio.Wave;

namespace pitch_shifter_demo_backend.Services;

public interface IAudioProcessor
{
    AudioStreamResult Process(WaveStream sourceStream, AudioProcessingParameters parameters, CancellationToken cancellationToken = default);
}
