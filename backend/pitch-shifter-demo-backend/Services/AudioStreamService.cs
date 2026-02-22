using System.Collections.Concurrent;
using System.Text;
using Microsoft.Extensions.Options;
using NAudio.Wave;
using pitch_shifter_demo_backend.Options;

namespace pitch_shifter_demo_backend.Services;

/// <summary>
/// Streams static audio files from the configured samples path using NAudio for validation.
/// Resolves the sample path relative to the application content root when configured path is relative.
/// </summary>
public class AudioStreamService : IAudioStreamService
{
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

    public AudioStreamService(
        IOptions<AudioOptions> options,
        IWebHostEnvironment environment,
        ILogger<AudioStreamService> logger)
    {
        _options = options.Value;
        _environment = environment;
        _logger = logger;
    }

    /// <inheritdoc />
    public Task<AudioStreamResult?> GetDefaultStreamAsync(CancellationToken cancellationToken = default)
    {
        var fullPath = ResolveSamplePath();
        if (string.IsNullOrEmpty(fullPath))
        {
            _logger.LogWarning("Audio sample path is not configured or resolved to nothing");
            return Task.FromResult(CreateFallbackTone("sample path is not configured"));
        }

        var path = Path.IsPathRooted(fullPath)
            ? fullPath
            : Path.Combine(_environment.ContentRootPath, fullPath);

        var fileName = _options.DefaultFileName;
        if (!string.IsNullOrEmpty(fileName))
            path = Path.Combine(path, fileName);
        else
        {
            // Single file in directory: use first supported file if no default name
            if (!File.Exists(path) && Directory.Exists(path))
            {
                var first = Directory.EnumerateFiles(path)
                    .FirstOrDefault(f => ContentTypeByExtension.ContainsKey(Path.GetExtension(f)));
                if (first is null)
                {
                    _logger.LogWarning("No supported audio file found in {Path}", path);
                    return Task.FromResult(CreateFallbackTone($"no supported audio file found in {path}"));
                }
                path = first;
            }
        }

        if (!File.Exists(path))
        {
            _logger.LogWarning("Audio sample file not found: {Path}", path);
            return Task.FromResult(CreateFallbackTone($"audio sample file not found: {path}"));
        }

        var contentType = GetContentType(path);
        try
        {
            // Validate with NAudio, then stream file bytes (async-friendly FileStream)
            using (var _ = new AudioFileReader(path))
            {
                // NAudio opened the file successfully; stream the same file for response
            }

            var fileStream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, bufferSize: 4096, useAsync: true);
            return Task.FromResult<AudioStreamResult?>(new AudioStreamResult(fileStream, contentType));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to open audio file with NAudio: {Path}", path);
            return Task.FromResult(CreateFallbackTone($"NAudio validation failed for {path}"));
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

    private AudioStreamResult? CreateFallbackTone(string reason)
    {
        if (!_options.EnableFallbackTone)
            return null;

        try
        {
            _logger.LogWarning("Falling back to generated tone because {Reason}", reason);
            var stream = BuildSineWaveStream();
            return new AudioStreamResult(stream, "audio/wav");
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
