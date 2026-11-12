using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using pitch_shifter_demo_backend.Tests.Support;

namespace pitch_shifter_demo_backend.Tests;

/// <summary>Exercises the HTTP surface with the real pipeline hosted in-process.</summary>
public class ApiEndpointsTests : IDisposable
{
    private readonly TempDirectory _samples = new();
    private readonly List<WebApplicationFactory<Program>> _factories = [];

    public void Dispose()
    {
        foreach (var factory in _factories) factory.Dispose();
        _samples.Dispose();
    }

    private HttpClient CreateClient(params (string Key, string Value)[] settings)
    {
        var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Audio:SamplesPath", _samples.Path);
            builder.UseSetting("HttpsRedirection:Enabled", "false");
            foreach (var (key, value) in settings) builder.UseSetting(key, value);
        });
        _factories.Add(factory);
        return factory.CreateClient();
    }

    [Fact]
    public async Task Health_reports_ok()
    {
        var client = CreateClient();

        var response = await client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("ok", json.RootElement.GetProperty("status").GetString());
    }

    [Theory]
    [InlineData("tempoPercent=10", "tempoPercent")]
    [InlineData("tempoPercent=200", "tempoPercent")]
    [InlineData("pitchSemitones=13", "pitchSemitones")]
    [InlineData("pitchSemitones=0.3", "pitchSemitones")]
    public async Task Invalid_parameters_are_rejected_with_a_message(string query, string expectedField)
    {
        var client = CreateClient();

        foreach (var path in new[] { "/api/audio/stream", "/api/audio/metadata" })
        {
            var response = await client.GetAsync($"{path}?{query}");

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            Assert.Contains(expectedField, json.RootElement.GetProperty("error").GetString());
        }
    }

    [Fact]
    public async Task Negative_start_offset_is_rejected()
    {
        var client = CreateClient();

        var response = await client.GetAsync("/api/audio/stream?startSeconds=-1");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Metadata_reports_source_and_processed_durations()
    {
        TestAudio.WriteSineWav(_samples.Path, "tone.wav", seconds: 4);
        var client = CreateClient();

        var response = await client.GetAsync("/api/audio/metadata?tempoPercent=50");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(4.0, json.RootElement.GetProperty("sourceDurationSeconds").GetDouble(), precision: 2);
        Assert.Equal(8.0, json.RootElement.GetProperty("processedDurationSeconds").GetDouble(), precision: 2);
    }

    [Fact]
    public async Task Unprocessed_stream_serves_the_sample_and_supports_range_requests()
    {
        TestAudio.WriteSineWav(_samples.Path, "tone.wav", seconds: 1);
        var client = CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/audio/stream");
        request.Headers.Range = new RangeHeaderValue(0, 99);

        var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.PartialContent, response.StatusCode);
        Assert.Equal("audio/wav", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal(100, (await response.Content.ReadAsByteArrayAsync()).Length);
    }

    [Fact]
    public async Task Empty_samples_folder_streams_the_fallback_tone()
    {
        var client = CreateClient();

        var response = await client.GetAsync("/api/audio/stream");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("audio/wav", response.Content.Headers.ContentType?.MediaType);
        Assert.True((await response.Content.ReadAsByteArrayAsync()).Length > 44);
    }

    [Fact]
    public async Task Disabled_fallback_without_a_sample_yields_not_found()
    {
        var client = CreateClient(("Audio:EnableFallbackTone", "false"));

        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/audio/stream")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/audio/metadata")).StatusCode);
    }

    [Fact]
    public async Task Diagnostics_describe_the_resolved_sample()
    {
        TestAudio.WriteSineWav(_samples.Path, "tone.wav", seconds: 1);
        var client = CreateClient();

        var json = await client.GetFromJsonAsync<JsonElement>("/diagnostics/audio");

        Assert.True(json.GetProperty("basePathExists").GetBoolean());
        Assert.True(json.GetProperty("fileExists").GetBoolean());
        Assert.EndsWith("tone.wav", json.GetProperty("resolvedFilePath").GetString());
    }

    [Fact]
    public async Task Configured_origin_receives_cors_headers()
    {
        var client = CreateClient(("Cors:AllowedOrigins:0", "https://demo.example.com/"));
        using var request = new HttpRequestMessage(HttpMethod.Get, "/health");
        request.Headers.Add("Origin", "https://demo.example.com");

        var response = await client.SendAsync(request);

        Assert.Equal("https://demo.example.com", response.Headers.GetValues("Access-Control-Allow-Origin").Single());
    }

    [Fact]
    public async Task Unlisted_origin_receives_no_cors_headers()
    {
        var client = CreateClient(("Cors:AllowedOrigins:0", "https://demo.example.com"));
        using var request = new HttpRequestMessage(HttpMethod.Get, "/health");
        request.Headers.Add("Origin", "https://other.example.com");

        var response = await client.SendAsync(request);

        Assert.False(response.Headers.Contains("Access-Control-Allow-Origin"));
    }

    [Fact]
    public async Task Empty_origin_list_disables_cross_origin_access()
    {
        var client = CreateClient(("Cors:AllowedOrigins:0", ""));
        using var request = new HttpRequestMessage(HttpMethod.Get, "/health");
        request.Headers.Add("Origin", "http://localhost:4200");

        var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.False(response.Headers.Contains("Access-Control-Allow-Origin"));
    }
}
