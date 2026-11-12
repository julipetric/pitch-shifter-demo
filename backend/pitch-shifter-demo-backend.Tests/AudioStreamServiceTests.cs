using Microsoft.Extensions.Logging.Abstractions;
using NAudio.Wave;
using pitch_shifter_demo_backend.Options;
using pitch_shifter_demo_backend.Services;
using pitch_shifter_demo_backend.Tests.Support;

namespace pitch_shifter_demo_backend.Tests;

public class AudioStreamServiceTests : IDisposable
{
    private readonly TempDirectory _samples = new();

    public void Dispose() => _samples.Dispose();

    private AudioStreamService CreateService(
        IAudioProcessor? processor = null,
        Action<AudioOptions>? configure = null)
    {
        var options = new AudioOptions { SamplesPath = _samples.Path };
        configure?.Invoke(options);
        return new AudioStreamService(
            Microsoft.Extensions.Options.Options.Create(options),
            new StubWebHostEnvironment(_samples.Path),
            NullLogger<AudioStreamService>.Instance,
            processor ?? new RecordingAudioProcessor());
    }

    private static AudioProcessingParameters Params(double tempo = 100, double pitch = 0, bool preserve = true)
        => new(tempo, preserve, pitch);

    private static async Task<byte[]> ReadAll(Stream stream)
    {
        using var copy = new MemoryStream();
        await stream.CopyToAsync(copy);
        await stream.DisposeAsync();
        return copy.ToArray();
    }

    [Fact]
    public async Task Empty_samples_folder_yields_a_five_second_mono_wav_tone()
    {
        var service = CreateService();

        var result = await service.GetDefaultStreamAsync(Params());

        Assert.NotNull(result);
        Assert.Equal("audio/wav", result!.ContentType);
        Assert.True(result.EnableRangeProcessing);
        using var reader = new WaveFileReader(result.Stream);
        Assert.Equal(44100, reader.WaveFormat.SampleRate);
        Assert.Equal(1, reader.WaveFormat.Channels);
        Assert.Equal(16, reader.WaveFormat.BitsPerSample);
        Assert.Equal(5.0, reader.TotalTime.TotalSeconds, precision: 3);
    }

    [Fact]
    public async Task Fallback_tone_is_a_440_hz_sine_with_headroom()
    {
        var service = CreateService();
        var result = await service.GetDefaultStreamAsync(Params());

        using var reader = new WaveFileReader(result!.Stream);
        var samples = new float[44100];
        var read = reader.ToSampleProvider().Read(samples, 0, samples.Length);

        Assert.Equal(samples.Length, read);
        Assert.InRange(samples.Max(), 0.24f, 0.26f);
        Assert.InRange(samples.Min(), -0.26f, -0.24f);

        // A 440 Hz sine crosses zero upwards 440 times per second.
        var risingCrossings = 0;
        for (var i = 1; i < samples.Length; i++)
        {
            if (samples[i - 1] < 0 && samples[i] >= 0) risingCrossings++;
        }
        Assert.InRange(risingCrossings, 439, 441);
    }

    [Fact]
    public async Task Missing_samples_folder_also_falls_back_to_the_tone()
    {
        var service = CreateService(configure: o => o.SamplesPath = Path.Combine(_samples.Path, "does-not-exist"));

        var result = await service.GetDefaultStreamAsync(Params());

        Assert.NotNull(result);
        Assert.Equal("audio/wav", result!.ContentType);
    }

    [Fact]
    public async Task Disabled_fallback_returns_no_stream_when_no_sample_exists()
    {
        var service = CreateService(configure: o => o.EnableFallbackTone = false);

        Assert.Null(await service.GetDefaultStreamAsync(Params()));
        Assert.Null(await service.GetDefaultMetadataAsync(Params()));
    }

    [Fact]
    public async Task Unprocessed_request_streams_the_sample_file_byte_for_byte()
    {
        var path = TestAudio.WriteSineWav(_samples.Path, "tone.wav", seconds: 1);
        var service = CreateService();

        var result = await service.GetDefaultStreamAsync(Params());

        Assert.NotNull(result);
        Assert.Equal("audio/wav", result!.ContentType);
        Assert.True(result.EnableRangeProcessing);
        Assert.Equal(await File.ReadAllBytesAsync(path), await ReadAll(result.Stream));
    }

    [Fact]
    public async Task Unsupported_files_in_the_samples_folder_are_ignored()
    {
        await File.WriteAllTextAsync(Path.Combine(_samples.Path, "notes.txt"), "not audio");
        TestAudio.WriteSineWav(_samples.Path, "tone.wav", seconds: 1);
        var service = CreateService();

        var metadata = await service.GetDefaultMetadataAsync(Params());

        Assert.Equal(1.0, metadata!.SourceDurationSeconds, precision: 2);
    }

    [Fact]
    public async Task Default_file_name_selects_the_sample()
    {
        TestAudio.WriteSineWav(_samples.Path, "a-short.wav", seconds: 1);
        TestAudio.WriteSineWav(_samples.Path, "b-long.wav", seconds: 3);
        var service = CreateService(configure: o => o.DefaultFileName = "b-long.wav");

        var metadata = await service.GetDefaultMetadataAsync(Params());

        Assert.Equal(3.0, metadata!.SourceDurationSeconds, precision: 2);
    }

    [Theory]
    [InlineData(100, 2.0)]
    [InlineData(50, 4.0)]
    [InlineData(125, 1.6)]
    public async Task Processed_duration_is_source_duration_divided_by_the_tempo_ratio(double tempo, double expected)
    {
        TestAudio.WriteSineWav(_samples.Path, "tone.wav", seconds: 2);
        var service = CreateService();

        var metadata = await service.GetDefaultMetadataAsync(Params(tempo));

        Assert.NotNull(metadata);
        Assert.Equal(2.0, metadata!.SourceDurationSeconds, precision: 2);
        Assert.Equal(expected, metadata.ProcessedDurationSeconds, precision: 2);
    }

    [Fact]
    public async Task Pitch_alone_does_not_change_the_processed_duration()
    {
        TestAudio.WriteSineWav(_samples.Path, "tone.wav", seconds: 2);
        var service = CreateService();

        var metadata = await service.GetDefaultMetadataAsync(Params(tempo: 100, pitch: 5));

        Assert.Equal(metadata!.SourceDurationSeconds, metadata.ProcessedDurationSeconds, precision: 6);
    }

    [Theory]
    [InlineData(100, 5.0)]
    [InlineData(50, 10.0)]
    [InlineData(125, 4.0)]
    public async Task Fallback_metadata_describes_the_five_second_tone(double tempo, double expectedProcessed)
    {
        var service = CreateService();

        var metadata = await service.GetDefaultMetadataAsync(Params(tempo));

        Assert.Equal(5.0, metadata!.SourceDurationSeconds);
        Assert.Equal(expectedProcessed, metadata.ProcessedDurationSeconds, precision: 6);
    }

    [Fact]
    public async Task Undecodable_sample_falls_back_to_the_tone()
    {
        await File.WriteAllTextAsync(Path.Combine(_samples.Path, "broken.wav"), "this is not a RIFF file");
        var service = CreateService();

        var stream = await service.GetDefaultStreamAsync(Params());
        var metadata = await service.GetDefaultMetadataAsync(Params());

        Assert.Equal("audio/wav", stream!.ContentType);
        Assert.Equal(5.0, metadata!.SourceDurationSeconds);
    }

    [Fact]
    public async Task Processed_request_is_delegated_to_the_processor_with_the_parameters()
    {
        TestAudio.WriteSineWav(_samples.Path, "tone.wav", seconds: 4);
        var processor = new RecordingAudioProcessor();
        var service = CreateService(processor);
        var parameters = Params(tempo: 80, pitch: 3, preserve: true);

        var result = await service.GetDefaultStreamAsync(parameters);

        Assert.Equal(1, processor.Calls);
        Assert.Equal(parameters, processor.LastParameters);
        Assert.Equal("audio/mpeg", result!.ContentType);
        Assert.False(result.EnableRangeProcessing);
    }

    [Fact]
    public async Task Start_offset_is_converted_from_the_processed_to_the_source_timeline()
    {
        TestAudio.WriteSineWav(_samples.Path, "tone.wav", seconds: 10);
        var processor = new RecordingAudioProcessor();
        var service = CreateService(processor);

        // 4 s into a stream played at 50% tempo is 2 s into the source.
        await service.GetDefaultStreamAsync(Params(tempo: 50), startSeconds: 4);

        Assert.Equal(2.0, processor.LastSourcePosition!.Value.TotalSeconds, precision: 2);
    }

    [Fact]
    public async Task Start_offset_beyond_the_end_is_clamped_to_the_source_duration()
    {
        TestAudio.WriteSineWav(_samples.Path, "tone.wav", seconds: 2);
        var processor = new RecordingAudioProcessor();
        var service = CreateService(processor);

        await service.GetDefaultStreamAsync(Params(tempo: 100, pitch: 1), startSeconds: 999);

        Assert.Equal(1, processor.Calls);
        Assert.InRange(processor.LastSourcePosition!.Value.TotalSeconds, 1.9, 2.01);
    }

    [Fact]
    public async Task Processor_failure_serves_the_original_file()
    {
        var path = TestAudio.WriteSineWav(_samples.Path, "tone.wav", seconds: 1);
        var service = CreateService(new ThrowingAudioProcessor());

        var result = await service.GetDefaultStreamAsync(Params(tempo: 80));

        Assert.Equal("audio/wav", result!.ContentType);
        Assert.Equal(new FileInfo(path).Length, (await ReadAll(result.Stream)).Length);
    }
}
