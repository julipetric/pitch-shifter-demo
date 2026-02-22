namespace pitch_shifter_demo_backend.Options;

/// <summary>
/// Configuration for static audio sample storage and streaming.
/// Bound to the "Audio" section in appsettings.
/// </summary>
public class AudioOptions
{
    public const string SectionName = "Audio";

    /// <summary>
    /// Path to the folder containing sample audio files (relative to content root or absolute).
    /// </summary>
    public string SamplesPath { get; set; } = "Content/Samples";

    /// <summary>
    /// Optional default filename to stream when no sample is specified (e.g. "demo.mp3").
    /// </summary>
    public string? DefaultFileName { get; set; }

    /// <summary>
    /// When true, generate a short fallback tone if no sample file is available.
    /// </summary>
    public bool EnableFallbackTone { get; set; } = true;
}
