using NAudio.Wave;

namespace pitch_shifter_demo_backend.Tests.Support;

/// <summary>Builds small throwaway audio files for tests.</summary>
internal static class TestAudio
{
    /// <summary>Writes a mono 16-bit 8 kHz sine WAV of the given length and returns its path.</summary>
    public static string WriteSineWav(string directory, string fileName, double seconds, double frequency = 440)
    {
        const int sampleRate = 8000;
        var path = Path.Combine(directory, fileName);
        using var writer = new WaveFileWriter(path, new WaveFormat(sampleRate, 16, 1));
        var total = (int)(sampleRate * seconds);
        for (var n = 0; n < total; n++)
        {
            var sample = (float)(Math.Sin(2 * Math.PI * frequency * n / sampleRate) * 0.25);
            writer.WriteSample(sample);
        }
        return path;
    }
}

/// <summary>A uniquely named directory that is deleted on dispose.</summary>
internal sealed class TempDirectory : IDisposable
{
    public string Path { get; } = System.IO.Path.Combine(
        System.IO.Path.GetTempPath(), "pitch-shifter-tests-" + Guid.NewGuid().ToString("N"));

    public TempDirectory() => Directory.CreateDirectory(Path);

    public void Dispose()
    {
        try
        {
            Directory.Delete(Path, recursive: true);
        }
        catch (IOException)
        {
            // Cleanup is best-effort; a locked temp file must not fail the test run.
        }
    }
}
