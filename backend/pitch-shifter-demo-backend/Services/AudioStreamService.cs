using System.Collections.Concurrent;
using System.Text;
using Microsoft.Extensions.Options;
using NAudio.Wave;
using NLayer.NAudioSupport;
using pitch_shifter_demo_backend.Options;

namespace pitch_shifter_demo_backend.Services;

/// <summary>
/// Streams static audio files from the configured samples path using NAudio for validation.
/// Resolves the sample path relative to the application content root when configured path is relative.
/// </summary>
public class AudioStreamService : IAudioStreamService
{
    private const double FallbackToneSeconds = 5.0;
    private static readonly ConcurrentDictionary<string, string> ContentTypeByExtension = new(StringComparer.OrdinalIgnoreCase)
    {
        [".mp3"] = "audio/mpeg",
        [".wav"] = "audio/wav",
        [".wave"] = "audio/wav",
        [".ogg"] = "audio/ogg",
        [".m4a"] = "audio/mp4",
        [".aac"] = "audio/aac",
    };

    private readonly AudioOptions _options;
    private readonly IWebHostEnvironment _environment;
    private readonly ILogger<AudioStreamService> _logger;
    private readonly IAudioProcessor _audioProcessor;

    public AudioStreamService(
        IOptions<AudioOptions> options,
        IWebHostEnvironment environment,
        ILogger<AudioStreamService> logger,
        IAudioProcessor audioProcessor)
    {
        _options = options.Value;
        _environment = environment;
        _logger = logger;
        _audioProcessor = audioProcessor;
    }

    /// <inheritdoc />
    public Task<AudioStreamResult?> GetDefaultStreamAsync(CancellationToken cancellationToken = default)
    {
        return GetDefaultStreamAsync(AudioProcessingParameters.Default, cancellationToken);
    }

    /// <inheritdoc />
    public Task<AudioStreamResult?> GetDefaultStreamAsync(AudioProcessingParameters parameters, CancellationToken cancellationToken = default)
    {
        return GetDefaultStreamAsync(parameters, startSeconds: 0, cancellationToken);
    }

    /// <inheritdoc />
    public Task<AudioStreamResult?> GetDefaultStreamAsync(
        AudioProcessingParameters parameters,
        double startSeconds,
        CancellationToken cancellationToken = default)
    {
        if (!TryResolveSampleFilePath(out var path, out var reason))
        {
            _logger.LogWarning("Audio sample path could not be resolved: {Reason}", reason);
            return Task.FromResult(CreateFallbackTone(reason));
        }

        try
        {
            var result = parameters.IsDefault
                ? TryBuildFileStream(path)
                : TryBuildProcessedStream(path, parameters, startSeconds, cancellationToken);

            return Task.FromResult(result ?? CreateFallbackTone("audio stream could not be generated"));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to open audio file with NAudio: {Path}", path);
            return Task.FromResult(CreateFallbackTone($"NAudio validation failed for {path}"));
        }
    }

    /// <inheritdoc />
    public Task<AudioMetadata?> GetDefaultMetadataAsync(
        AudioProcessingParameters parameters,
        CancellationToken cancellationToken = default)
    {
        if (!TryResolveSampleFilePath(out var path, out var reason))
        {
            if (!_options.EnableFallbackTone)
            {
                _logger.LogWarning("Audio metadata unavailable: {Reason}", reason);
                return Task.FromResult<AudioMetadata?>(null);
            }

            var processedDuration = FallbackToneSeconds / parameters.TempoRatio;
            return Task.FromResult<AudioMetadata?>(new AudioMetadata(FallbackToneSeconds, processedDuration));
        }

        try
        {
            using var reader = CreateAudioReader(path);
            var sourceDuration = reader.TotalTime.TotalSeconds;
            var processedDuration = sourceDuration / parameters.TempoRatio;
            return Task.FromResult<AudioMetadata?>(new AudioMetadata(sourceDuration, processedDuration));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to read audio metadata from {Path}", path);
            if (!_options.EnableFallbackTone)
                return Task.FromResult<AudioMetadata?>(null);

            var processedDuration = FallbackToneSeconds / parameters.TempoRatio;
            return Task.FromResult<AudioMetadata?>(new AudioMetadata(FallbackToneSeconds, processedDuration));
        }
    }

    private string? ResolveSamplePath()
    {
        var path = _options.SamplesPath;
        if (string.IsNullOrWhiteSpace(path)) return null;
        return path.Trim();
    }

    private static string GetContentType(string filePath)
    {
        var ext = Path.GetExtension(filePath);
        return ContentTypeByExtension.TryGetValue(ext, out var contentType) ? contentType : "application/octet-stream";
    }

    /// <summary>
    /// Creates a WaveStream for the given path. Uses NLayer's managed MP3 decoder for .mp3 files
    /// so playback works on Azure App Service (Windows Server lacks the ACM MP3 codec).
    /// Uses NAudio.Core only to avoid NAudio/NAudio.Core assembly mismatch (TypeLoadException).
    /// </summary>
    private static WaveStream CreateAudioReader(string path)
    {
        var ext = Path.GetExtension(path);
        if (string.Equals(ext, ".mp3", StringComparison.OrdinalIgnoreCase))
        {
            var builder = new Mp3FileReaderBase.FrameDecompressorBuilder(wf => new Mp3FrameDecompressor(wf));
            return new Mp3FileReaderBase(path, builder);
        }
        // WAV and other formats: WaveFileReader (fails for .ogg/.m4a/.aac, triggering fallback)
        return new WaveFileReader(path);
    }

    private AudioStreamResult? TryBuildFileStream(string path)
    {
        var contentType = GetContentType(path);

        if (!ValidateAudioFile(path, out var error))
        {
            _logger.LogWarning("NAudio validation failed for {Path}: {Error}", path, error);
            return null;
        }

        var fileStream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, bufferSize: 4096, useAsync: true);
        return new AudioStreamResult(fileStream, contentType, EnableRangeProcessing: true);
    }

    private AudioStreamResult? TryBuildProcessedStream(
        string path,
        AudioProcessingParameters parameters,
        double startSeconds,
        CancellationToken cancellationToken)
    {
        WaveStream? reader = null;
        try
        {
            reader = CreateAudioReader(path);
            var sourceStartSeconds = Math.Max(0, startSeconds) * parameters.TempoRatio;
            if (reader.TotalTime.TotalSeconds > 0 && sourceStartSeconds > reader.TotalTime.TotalSeconds)
            {
                sourceStartSeconds = reader.TotalTime.TotalSeconds;
            }

            reader.CurrentTime = TimeSpan.FromSeconds(sourceStartSeconds);
            return _audioProcessor.Process(reader, parameters, cancellationToken);
        }
        catch (Exception ex)
        {
            reader?.Dispose();
            _logger.LogWarning(ex, "Failed to process audio file, falling back to original stream: {Path}", path);
            return TryBuildFileStream(path);
        }
    }

    private static bool ValidateAudioFile(string path, out string? error)
    {
        try
        {
            using var _ = CreateAudioReader(path);
            error = null;
            return true;
        }
        catch (Exception ex)
        {
            error = ex.Message;
            return false;
        }
    }

    private bool TryResolveSampleFilePath(out string path, out string reason)
    {
        path = string.Empty;
        reason = "sample path is not configured";

        var fullPath = ResolveSamplePath();
        if (string.IsNullOrEmpty(fullPath))
            return false;

        path = Path.IsPathRooted(fullPath)
            ? fullPath
            : Path.Combine(_environment.ContentRootPath, fullPath);

        var fileName = _options.DefaultFileName;
        if (!string.IsNullOrEmpty(fileName))
        {
            path = Path.Combine(path, fileName);
        }
        else if (!File.Exists(path) && Directory.Exists(path))
        {
            var first = Directory.EnumerateFiles(path)
                .FirstOrDefault(f => ContentTypeByExtension.ContainsKey(Path.GetExtension(f)));
            if (first is null)
            {
                reason = $"no supported audio file found in {path}";
                return false;
            }
            path = first;
        }

        if (!File.Exists(path))
        {
            reason = $"audio sample file not found: {path}";
            return false;
        }

        reason = string.Empty;
        return true;
    }

    private AudioStreamResult? CreateFallbackTone(string reason)
    {
        if (!_options.EnableFallbackTone)
            return null;

        try
        {
            _logger.LogWarning("Falling back to generated tone because {Reason}", reason);
            var stream = BuildSineWaveStream();
            return new AudioStreamResult(stream, "audio/wav", EnableRangeProcessing: true);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to generate fallback audio tone");
            return null;
        }
    }

    private static MemoryStream BuildSineWaveStream()
    {
        const int sampleRate = 44100;
        const int seconds = 5;
        const int channels = 1;
        const short bitsPerSample = 16;
        const double frequency = 440.0;
        const double amplitude = 0.25;

        var totalSamples = sampleRate * seconds;
        var bytesPerSample = bitsPerSample / 8;
        var dataSize = totalSamples * channels * bytesPerSample;
        var stream = new MemoryStream(44 + dataSize);

        using (var writer = new BinaryWriter(stream, Encoding.ASCII, leaveOpen: true))
        {
            writer.Write(Encoding.ASCII.GetBytes("RIFF"));
            writer.Write(36 + dataSize);
            writer.Write(Encoding.ASCII.GetBytes("WAVE"));
            writer.Write(Encoding.ASCII.GetBytes("fmt "));
            writer.Write(16);
            writer.Write((short)1);
            writer.Write((short)channels);
            writer.Write(sampleRate);
            writer.Write(sampleRate * channels * bytesPerSample);
            writer.Write((short)(channels * bytesPerSample));
            writer.Write(bitsPerSample);
            writer.Write(Encoding.ASCII.GetBytes("data"));
            writer.Write(dataSize);

            for (var n = 0; n < totalSamples; n++)
            {
                var sample = (short)(Math.Sin((2 * Math.PI * frequency * n) / sampleRate)
                                     * short.MaxValue * amplitude);
                writer.Write(sample);
            }
        }

        stream.Position = 0;
        return stream;
    }
}
