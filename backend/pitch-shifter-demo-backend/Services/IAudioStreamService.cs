namespace pitch_shifter_demo_backend.Services;

/// <summary>
/// Provides a stream of audio bytes and content type for the default or a given sample.
/// </summary>
public interface IAudioStreamService
{
    /// <summary>
    /// Gets a stream for the default sample and its content type.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>A result with stream and content type, or null if the sample is missing or invalid and fallback is disabled.</returns>
    Task<AudioStreamResult?> GetDefaultStreamAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets a stream for the default sample with processing parameters applied.
    /// </summary>
    /// <param name="parameters">Processing parameters for tempo, pitch, and preserve-pitch behavior.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>A result with stream and content type, or null if the sample is missing or invalid and fallback is disabled.</returns>
    Task<AudioStreamResult?> GetDefaultStreamAsync(AudioProcessingParameters parameters, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets a stream for the default sample with processing parameters applied, starting from a given time offset.
    /// </summary>
    /// <param name="parameters">Processing parameters for tempo, pitch, and preserve-pitch behavior.</param>
    /// <param name="startSeconds">Offset in seconds on the processed timeline.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>A result with stream and content type, or null if the sample is missing or invalid and fallback is disabled.</returns>
    Task<AudioStreamResult?> GetDefaultStreamAsync(AudioProcessingParameters parameters, double startSeconds, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets audio metadata for the default sample with processing parameters applied.
    /// </summary>
    /// <param name="parameters">Processing parameters for tempo, pitch, and preserve-pitch behavior.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Audio metadata including source and processed duration, or null if unavailable.</returns>
    Task<AudioMetadata?> GetDefaultMetadataAsync(AudioProcessingParameters parameters, CancellationToken cancellationToken = default);
}

/// <summary>
/// Result of a successful audio stream lookup.
/// </summary>
/// <param name="Stream">The audio stream. Caller is responsible for disposing.</param>
/// <param name="ContentType">The MIME content type (e.g. audio/mpeg, audio/wav).</param>
public record AudioStreamResult(Stream Stream, string ContentType, bool EnableRangeProcessing);

public record AudioMetadata(double SourceDurationSeconds, double ProcessedDurationSeconds);
