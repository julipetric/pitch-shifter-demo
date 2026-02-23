namespace pitch_shifter_demo_backend.Services;

public sealed record AudioProcessingParameters(double TempoPercent, bool PreservePitch, double PitchSemitones)
{
    public const double TempoPercentDefault = 100;
    public const double TempoPercentMin = 50;
    public const double TempoPercentMax = 125;
    public const double PitchSemitonesMin = -12;
    public const double PitchSemitonesMax = 12;
    public const double PitchSemitoneStep = 0.5;
    private const double Tolerance = 0.0001;

    public static readonly AudioProcessingParameters Default = new(TempoPercentDefault, true, 0);

    public double TempoRatio => TempoPercent / 100.0;

    public bool IsDefault =>
        Math.Abs(TempoPercent - TempoPercentDefault) < Tolerance
        && Math.Abs(PitchSemitones) < Tolerance;

    public static bool TryCreate(
        double? tempoPercent,
        bool? preservePitch,
        double? pitchSemitones,
        out AudioProcessingParameters parameters,
        out string? error)
    {
        var tempo = tempoPercent ?? TempoPercentDefault;
        var preserve = preservePitch ?? true;
        var pitch = pitchSemitones ?? 0;

        if (tempo < TempoPercentMin || tempo > TempoPercentMax)
        {
            parameters = Default;
            error = $"tempoPercent must be between {TempoPercentMin} and {TempoPercentMax}.";
            return false;
        }

        if (pitch < PitchSemitonesMin || pitch > PitchSemitonesMax)
        {
            parameters = Default;
            error = $"pitchSemitones must be between {PitchSemitonesMin} and {PitchSemitonesMax}.";
            return false;
        }

        if (!IsMultipleOfStep(pitch, PitchSemitoneStep))
        {
            parameters = Default;
            error = $"pitchSemitones must be in {PitchSemitoneStep} increments.";
            return false;
        }

        parameters = new AudioProcessingParameters(tempo, preserve, pitch);
        error = null;
        return true;
    }

    private static bool IsMultipleOfStep(double value, double step)
    {
        if (Math.Abs(value) < Tolerance) return true;
        var steps = value / step;
        return Math.Abs(steps - Math.Round(steps)) < Tolerance;
    }
}
