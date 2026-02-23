using System.Reflection;
using Microsoft.Extensions.Options;
using pitch_shifter_demo_backend.Options;
using pitch_shifter_demo_backend.Services;

// Redirect NAudio 1.9.0 requests to NAudio.Core (some transitive deps may still reference old NAudio)
AppDomain.CurrentDomain.AssemblyResolve += (_, args) =>
{
    var name = args.Name;
    if (name.StartsWith("NAudio,", StringComparison.OrdinalIgnoreCase))
    {
        return Assembly.Load("NAudio.Core");
    }
    return null;
};

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.Configure<AudioOptions>(builder.Configuration.GetSection(AudioOptions.SectionName));
builder.Services.AddSingleton<IAudioStreamService, AudioStreamService>();
builder.Services.AddSingleton<IAudioProcessor, SoundTouchAudioProcessor>();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("http://localhost:4200")
            .AllowAnyMethod()
            .AllowAnyHeader();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
// Swagger is enabled in all environments so /api/audio/stream is visible when deployed (e.g. Azure).
// Set "Swagger": { "Enabled": false } in appsettings or Azure App Settings to hide in production.
var swaggerEnabled = builder.Configuration.GetValue<bool>("Swagger:Enabled", true);
if (swaggerEnabled)
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();
app.UseHttpsRedirection();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }))
    .WithName("Health")
    .WithOpenApi();

app.MapGet("/api/audio/stream", async (
    double? tempoPercent,
    bool? preservePitch,
    double? pitchSemitones,
    double? startSeconds,
    IAudioStreamService streamService,
    CancellationToken cancellationToken) =>
{
    if (!AudioProcessingParameters.TryCreate(tempoPercent, preservePitch, pitchSemitones, out var parameters, out var error))
    {
        return Results.BadRequest(new { error });
    }

    var start = startSeconds ?? 0;
    if (start < 0)
    {
        return Results.BadRequest(new { error = "startSeconds must be greater than or equal to 0." });
    }

    var result = await streamService.GetDefaultStreamAsync(parameters, start, cancellationToken);
    if (result is null)
        return Results.NotFound();
    return Results.Stream(result.Stream, result.ContentType, enableRangeProcessing: result.EnableRangeProcessing);
})
    .WithName("GetAudioStream")
    .WithOpenApi(operation =>
{
    operation.Summary = "Stream default audio sample";
    operation.Description = "Returns the default static audio sample as a chunked stream. Optional query params: tempoPercent (50-125), preservePitch (true/false), pitchSemitones (-12 to 12 in 0.5 steps), startSeconds (offset on processed timeline). Configure sample path and optional default file in Audio section of appsettings.";
    return operation;
});

app.MapGet("/api/audio/metadata", async (
    double? tempoPercent,
    bool? preservePitch,
    double? pitchSemitones,
    IAudioStreamService streamService,
    CancellationToken cancellationToken) =>
{
    if (!AudioProcessingParameters.TryCreate(tempoPercent, preservePitch, pitchSemitones, out var parameters, out var error))
    {
        return Results.BadRequest(new { error });
    }

    var metadata = await streamService.GetDefaultMetadataAsync(parameters, cancellationToken);
    if (metadata is null)
        return Results.NotFound();

    return Results.Ok(new
    {
        sourceDurationSeconds = metadata.SourceDurationSeconds,
        processedDurationSeconds = metadata.ProcessedDurationSeconds
    });
})
    .WithName("GetAudioMetadata")
    .WithOpenApi(operation =>
{
    operation.Summary = "Get audio metadata for the default sample";
    operation.Description = "Returns source and processed duration seconds for the default sample with optional processing parameters.";
    return operation;
});

var supportedExtensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
{
    ".mp3",
    ".wav",
    ".wave",
    ".ogg",
    ".m4a",
    ".aac",
};

app.MapGet("/diagnostics/audio", (IOptions<AudioOptions> options, IWebHostEnvironment environment) =>
{
    var audio = options.Value;
    var samplesPath = string.IsNullOrWhiteSpace(audio.SamplesPath) ? null : audio.SamplesPath.Trim();
    string? basePath = null;
    string? resolvedFilePath = null;

    if (!string.IsNullOrEmpty(samplesPath))
    {
        basePath = Path.IsPathRooted(samplesPath)
            ? samplesPath
            : Path.Combine(environment.ContentRootPath, samplesPath);

        if (!string.IsNullOrWhiteSpace(audio.DefaultFileName))
        {
            resolvedFilePath = Path.Combine(basePath, audio.DefaultFileName);
        }
        else if (Directory.Exists(basePath))
        {
            resolvedFilePath = Directory.EnumerateFiles(basePath)
                .FirstOrDefault(file => supportedExtensions.Contains(Path.GetExtension(file)));
        }
        else if (File.Exists(basePath))
        {
            resolvedFilePath = basePath;
        }
    }

    var basePathExists = basePath is not null && (Directory.Exists(basePath) || File.Exists(basePath));
    var fileExists = resolvedFilePath is not null && File.Exists(resolvedFilePath);

    return Results.Ok(new
    {
        audio.SamplesPath,
        audio.DefaultFileName,
        audio.EnableFallbackTone,
        contentRoot = environment.ContentRootPath,
        resolvedBasePath = basePath,
        basePathExists,
        resolvedFilePath,
        fileExists,
        supportedExtensions = supportedExtensions.ToArray()
    });
})
    .WithName("AudioDiagnostics")
    .WithOpenApi();

app.Run();
