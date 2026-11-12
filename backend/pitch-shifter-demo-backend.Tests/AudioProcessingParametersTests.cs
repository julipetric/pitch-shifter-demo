using pitch_shifter_demo_backend.Services;

namespace pitch_shifter_demo_backend.Tests;

public class AudioProcessingParametersTests
{
    private static bool TryCreate(double? tempo, bool? preserve, double? pitch, out AudioProcessingParameters parameters, out string? error)
        => AudioProcessingParameters.TryCreate(tempo, preserve, pitch, out parameters, out error);

    [Fact]
    public void Omitted_values_produce_the_neutral_defaults()
    {
        var ok = TryCreate(null, null, null, out var parameters, out var error);

        Assert.True(ok);
        Assert.Null(error);
        Assert.Equal(100, parameters.TempoPercent);
        Assert.True(parameters.PreservePitch);
        Assert.Equal(0, parameters.PitchSemitones);
        Assert.True(parameters.IsDefault);
    }

    [Theory]
    [InlineData(50)]
    [InlineData(75.5)]
    [InlineData(100)]
    [InlineData(125)]
    public void Tempo_inside_the_range_is_accepted(double tempo)
    {
        Assert.True(TryCreate(tempo, null, null, out var parameters, out _));
        Assert.Equal(tempo, parameters.TempoPercent);
    }

    [Theory]
    [InlineData(49.9)]
    [InlineData(0)]
    [InlineData(-10)]
    [InlineData(125.1)]
    [InlineData(300)]
    public void Tempo_outside_the_range_is_rejected(double tempo)
    {
        var ok = TryCreate(tempo, null, null, out var parameters, out var error);

        Assert.False(ok);
        Assert.Contains("tempoPercent", error);
        Assert.Same(AudioProcessingParameters.Default, parameters);
    }

    [Theory]
    [InlineData(-12)]
    [InlineData(-0.5)]
    [InlineData(0)]
    [InlineData(7.5)]
    [InlineData(12)]
    public void Pitch_on_a_half_semitone_step_inside_the_range_is_accepted(double pitch)
    {
        Assert.True(TryCreate(null, null, pitch, out var parameters, out _));
        Assert.Equal(pitch, parameters.PitchSemitones);
    }

    [Theory]
    [InlineData(-12.5)]
    [InlineData(12.5)]
    [InlineData(100)]
    public void Pitch_outside_the_range_is_rejected(double pitch)
    {
        var ok = TryCreate(null, null, pitch, out _, out var error);

        Assert.False(ok);
        Assert.Contains("pitchSemitones must be between", error);
    }

    [Theory]
    [InlineData(0.3)]
    [InlineData(1.25)]
    [InlineData(-3.1)]
    public void Pitch_off_the_half_semitone_grid_is_rejected(double pitch)
    {
        var ok = TryCreate(null, null, pitch, out _, out var error);

        Assert.False(ok);
        Assert.Contains("increments", error);
    }

    [Fact]
    public void Preserve_pitch_flag_is_carried_through()
    {
        Assert.True(TryCreate(null, false, null, out var parameters, out _));
        Assert.False(parameters.PreservePitch);
    }

    [Theory]
    [InlineData(100, 1.0)]
    [InlineData(50, 0.5)]
    [InlineData(125, 1.25)]
    public void Tempo_ratio_is_the_percentage_divided_by_one_hundred(double tempo, double ratio)
    {
        TryCreate(tempo, null, null, out var parameters, out _);

        Assert.Equal(ratio, parameters.TempoRatio, precision: 6);
    }

    [Theory]
    [InlineData(100, 0, true)]
    [InlineData(100.00001, 0, true)]
    [InlineData(110, 0, false)]
    [InlineData(100, 2, false)]
    [InlineData(80, -1, false)]
    public void Default_means_neither_tempo_nor_pitch_is_changed(double tempo, double pitch, bool expected)
    {
        var parameters = new AudioProcessingParameters(tempo, true, pitch);

        Assert.Equal(expected, parameters.IsDefault);
    }

    [Fact]
    public void The_preserve_pitch_flag_alone_does_not_make_the_parameters_non_default()
    {
        var parameters = new AudioProcessingParameters(100, false, 0);

        Assert.True(parameters.IsDefault);
    }
}
