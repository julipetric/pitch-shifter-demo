using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.FileProviders;
using NAudio.Wave;
using pitch_shifter_demo_backend.Services;

namespace pitch_shifter_demo_backend.Tests.Support;

internal sealed class StubWebHostEnvironment : IWebHostEnvironment
{
    public StubWebHostEnvironment(string contentRoot) => ContentRootPath = contentRoot;

    public string ApplicationName { get; set; } = "tests";
    public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    public string ContentRootPath { get; set; }
    public string EnvironmentName { get; set; } = "Development";
    public string WebRootPath { get; set; } = string.Empty;
    public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
}

/// <summary>Records what it was asked to process and returns a canned stream.</summary>
internal sealed class RecordingAudioProcessor : IAudioProcessor
{
    public AudioProcessingParameters? LastParameters { get; private set; }
    public TimeSpan? LastSourcePosition { get; private set; }
    public int Calls { get; private set; }

    public AudioStreamResult Process(WaveStream sourceStream, AudioProcessingParameters parameters, CancellationToken cancellationToken = default)
    {
        Calls++;
        LastParameters = parameters;
        LastSourcePosition = sourceStream.CurrentTime;
        sourceStream.Dispose();
        return new AudioStreamResult(new MemoryStream([1, 2, 3]), "audio/mpeg", EnableRangeProcessing: false);
    }
}

internal sealed class ThrowingAudioProcessor : IAudioProcessor
{
    public AudioStreamResult Process(WaveStream sourceStream, AudioProcessingParameters parameters, CancellationToken cancellationToken = default)
        => throw new InvalidOperationException("processor failure");
}
