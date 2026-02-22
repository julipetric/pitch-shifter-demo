using System.Collections.Concurrent;
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
            return Task.FromResult<AudioStreamResult?>(null);
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
                    return Task.FromResult<AudioStreamResult?>(null);
                }
                path = first;
            }
        }

        if (!File.Exists(path))
        {
            _logger.LogWarning("Audio sample file not found: {Path}", path);
            return Task.FromResult<AudioStreamResult?>(null);
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
            return Task.FromResult<AudioStreamResult?>(null);
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
}
