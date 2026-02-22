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
if (app.Environment.IsDevelopment())
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
    return Results.Stream(result.Stream, result.ContentType, enableRangeProcessing: false);
})
    .WithName("GetAudioStream")
    .WithOpenApi(operation =>
{
    operation.Summary = "Stream default audio sample";
    operation.Description = "Returns the default static audio sample as a chunked stream. Configure sample path and optional default file in Audio section of appsettings.";
    return operation;
});

app.Run();
