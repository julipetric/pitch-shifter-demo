using Microsoft.Extensions.Options;
using pitch_shifter_demo_backend.Options;
using pitch_shifter_demo_backend.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.Configure<AudioOptions>(builder.Configuration.GetSection(AudioOptions.SectionName));
builder.Services.AddSingleton<IAudioStreamService, AudioStreamService>();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

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

app.UseHttpsRedirection();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }))
    .WithName("Health")
    .WithOpenApi();

app.MapGet("/api/audio/stream", async (IAudioStreamService streamService, CancellationToken cancellationToken) =>
{
    var result = await streamService.GetDefaultStreamAsync(cancellationToken);
    if (result is null)
        return Results.NotFound();
    return Results.Stream(result.Stream, result.ContentType, enableRangeProcessing: true);
})
    .WithName("GetAudioStream")
    .WithOpenApi(operation =>
{
    operation.Summary = "Stream default audio sample";
    operation.Description = "Returns the default static audio sample as a chunked stream. Configure sample path and optional default file in Audio section of appsettings.";
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
