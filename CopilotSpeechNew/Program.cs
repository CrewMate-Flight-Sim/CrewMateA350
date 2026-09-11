using System.Collections.Concurrent;
using System.Speech.AudioFormat;
using System.Speech.Recognition;
using System.Speech.Recognition.SrgsGrammar;
using System.Text.Json;
using NAudio.Wave;
using VoiceSidecar;

// ─── Constants ────────────────────────────────────────────────────────────────

const float CONFIDENCE_THRESHOLD = 0.85f;
var confidenceThreshold = CONFIDENCE_THRESHOLD;
var muted = false;

// Grammar path is passed as the first argument by the Tauri bridge so it resolves
// correctly in both dev (src-tauri/bin) and production (bundled resource dir).
var GRAMMAR_FILE =
    args.Length > 0 ? args[0] : Path.Combine(AppContext.BaseDirectory, "grammar.xml");

// name of the input device to use (empty / "default" = system default)
var inputDeviceName = args.Length > 1 ? args[1] : "";

// ─── Bootstrap ────────────────────────────────────────────────────────────────

// Flush stdout immediately — Tauri reads line by line
Console.OutputEncoding = System.Text.Encoding.UTF8;

EmitStatus("starting");

if (!File.Exists(GRAMMAR_FILE))
{
    EmitError($"Grammar file not found: {Path.GetFullPath(GRAMMAR_FILE)}");
    Environment.Exit(1);
}

// ─── Engine setup ─────────────────────────────────────────────────────────────

// Prefer SR 8.0 explicitly. Fall back to any installed English recognizer.
// Emit which recognizer was selected so Tauri can surface it in the UI.
var recognizerInfo =
    SpeechRecognitionEngine
        .InstalledRecognizers()
        .FirstOrDefault((r) => r.Name.Contains("8.0") && r.Culture.TwoLetterISOLanguageName == "en")
    ?? SpeechRecognitionEngine
        .InstalledRecognizers()
        .FirstOrDefault((r) => r.Culture.TwoLetterISOLanguageName == "en");

if (recognizerInfo is null)
{
    EmitError(
        "No English speech recognizer found. Please install the English language pack in Windows Settings → Time & Language → Speech, then restart the app."
    );
    Environment.Exit(1);
}

using var engine = new SpeechRecognitionEngine(recognizerInfo);

EmitStatus(
    "starting",
    new
    {
        recognizer = recognizerInfo.Name,
        recognizerId = recognizerInfo.Id,
        culture = recognizerInfo.Culture.Name,
    }
);

WaveInStream? waveInStream = null;
if (string.IsNullOrEmpty(inputDeviceName) || inputDeviceName == "default")
{
    try
    {
        engine.SetInputToDefaultAudioDevice();
    }
    catch (InvalidOperationException)
    {
        EmitError("No default audio input device found.");
        Environment.Exit(1);
    }
}
else
{
    waveInStream = SetInputToNamedDevice(engine, inputDeviceName);
    if (waveInStream is null)
    {
        EmitStatus(
            "warning",
            new { message = $"Input device not found: {inputDeviceName}. Falling back to default." }
        );
        try
        {
            engine.SetInputToDefaultAudioDevice();
        }
        catch (InvalidOperationException)
        {
            EmitError("No default audio input device found.");
            Environment.Exit(1);
        }
    }
}

var srgs = new SrgsDocument(System.Xml.XmlReader.Create(File.OpenRead(GRAMMAR_FILE)));
var grammar = new Grammar(srgs);
engine.LoadGrammar(grammar);

// ─── Event handlers ───────────────────────────────────────────────────────────

engine.SpeechRecognized += (sender, e) =>
{
    if (muted) return;

    if (e.Result.Confidence < confidenceThreshold)
    {
        EmitUnrecognized(e.Result.Text);
        return;
    }

    var sem = e.Result.Semantics;

    // Grammar guarantees these keys exist on every match
    if (!sem.ContainsKey("ActionRuleId") || !sem.ContainsKey("CmdId"))
    {
        EmitRejected(e.Result.Text, e.Result.Confidence, "missing_semantics");
        return;
    }

    var actionRuleId = sem["ActionRuleId"].Value?.ToString() ?? "";
    var cmdId = sem["CmdId"].Value?.ToString() ?? "";
    var cmdValue = sem.ContainsKey("CmdValue") ? sem["CmdValue"].Value?.ToString() ?? "" : "";

    var command = CommandDispatcher.Dispatch(actionRuleId, cmdId, cmdValue, e.Result.Text);

    if (command is null)
    {
        EmitRejected(e.Result.Text, e.Result.Confidence, "semantic_validation_failed");
        return;
    }

    EmitSpeech(command, e.Result.Confidence);
};

engine.SpeechRecognitionRejected += (sender, e) => {
    // Heard something but confidence was too low even
};

engine.RecognizeCompleted += (sender, e) =>
{
    if (e.Error is not null)
        EmitError(e.Error.Message);
};

// ─── Start ────────────────────────────────────────────────────────────────────

engine.RecognizeAsync(RecognizeMode.Multiple);

// Emit device list to the UI
{
    var devices = new List<object>();
    for (var i = 0; i < WaveIn.DeviceCount; i++)
    {
        var caps = WaveIn.GetCapabilities(i);
        devices.Add(
            new
            {
                index = i,
                name = caps.ProductName,
                isDefault = i == 0,
            }
        );
    }
    EmitInputDevices(devices);
}

EmitStatus("ready");

// ─── Stdin config loop ────────────────────────────────────────────────────────
// Accepts: {"confidenceThreshold": 0.75}

var stdinThread = new Thread(() =>
{
    string? line;
    while ((line = Console.In.ReadLine()) is not null)
    {
        try
        {
            var doc = JsonDocument.Parse(line);
            if (doc.RootElement.TryGetProperty("confidenceThreshold", out var ct))
            {
                if (ct.TryGetSingle(out var parsed) && float.IsFinite(parsed))
                    confidenceThreshold = Math.Clamp(parsed, 0.0f, 1.0f);
            }
            if (doc.RootElement.TryGetProperty("muted", out var m))
            {
                muted = m.GetBoolean();
            }
        }
        catch
        { /* ignore malformed input */
        }
    }
});
stdinThread.IsBackground = true;
stdinThread.Start();

// Keep process alive — Tauri sidecar owns the lifetime
Thread.Sleep(Timeout.Infinite);

// ─── Emit helpers ─────────────────────────────────────────────────────────────

static void EmitSpeech(VoiceCommand command, float confidence)
{
    var raw = command.Raw;
    // Detect pull vs set from the raw spoken text
    string verb =
        raw.Contains("pull", StringComparison.OrdinalIgnoreCase) ? "pull"
        : raw.Contains("manage", StringComparison.OrdinalIgnoreCase) ? "manage"
        : "set";

    // Reconstruct normalized text with correct verb so checklistRunner.ts still works
    string text = command.Type switch
    {
        "heading" when command.Payload.TryGetValue("value", out var v) => $"{verb} heading {v}",

        "speed" when command.Payload.TryGetValue("value", out var v) => $"{verb} speed {v}",

        "altitude" when command.Payload.TryGetValue("flightLevel", out var fl) => verb == "set"
            ? $"set flight level {fl}"
            : $"flight level {fl} {verb}",

        "altitude" when command.Payload.TryGetValue("value", out var v) => verb == "set"
            ? $"set altitude {v}"
            : $"altitude {v} {verb}",

        _ => command.Raw,
    };

    // Build enriched payload: original payload + verb for parametric commands
    Dictionary<string, object>? outPayload =
        command.Type is "heading" or "altitude" or "speed"
            ? new Dictionary<string, object>(command.Payload) { ["verb"] = verb }
        : command.Payload.Count > 0 ? command.Payload
        : null;

    WriteLine(
        outPayload is not null
            ? (object)
                new
                {
                    type = "speech",
                    commandType = command.Type,
                    payload = outPayload,
                    text,
                    confidence = Math.Round(confidence, 3),
                }
            : new
            {
                type = "speech",
                commandType = command.Type,
                text,
                confidence = Math.Round(confidence, 3),
            }
    );
}

static void EmitInputDevices(List<object> devices)
{
    WriteLine(new { type = "inputDevices", devices });
}

static void EmitUnrecognized(string text)
{
    WriteLine(new { type = "speech_unrecognized", text });
}

static WaveInStream? SetInputToNamedDevice(SpeechRecognitionEngine engine, string deviceName)
{
    for (var i = 0; i < WaveIn.DeviceCount; i++)
    {
        var caps = WaveIn.GetCapabilities(i);
        if (
            caps.ProductName.Contains(deviceName, StringComparison.OrdinalIgnoreCase)
            || deviceName.Contains(caps.ProductName, StringComparison.OrdinalIgnoreCase)
        )
        {
            var waveIn = new WaveIn
            {
                DeviceNumber = i,
                WaveFormat = new WaveFormat(16000, 16, 1),
                BufferMilliseconds = 100,
            };
            var stream = new WaveInStream(waveIn);
            engine.SetInputToAudioStream(
                stream,
                new SpeechAudioFormatInfo(16000, AudioBitsPerSample.Sixteen, AudioChannel.Mono)
            );
            waveIn.StartRecording();
            return stream;
        }
    }
    return null;
}

static void EmitStatus(string status, object? details = null)
{
    WriteLine(
        details is not null
            ? (object)
                new
                {
                    type = "status",
                    status,
                    details,
                }
            : new { type = "status", status }
    );
}

static void EmitError(string message)
{
    WriteLine(new { type = "error", message });
}

static void EmitRejected(string text, float confidence, string reason = "low_confidence")
{
    // Only emit in debug builds to avoid noise in production
#if DEBUG
    WriteLine(
        new
        {
            type = "rejected",
            text,
            confidence = Math.Round(confidence, 3),
            reason,
        }
    );
#endif
}

static void WriteLine(object payload)
{
    Console.WriteLine(JsonSerializer.Serialize(payload));
    Console.Out.Flush();
}

// ─── WaveInStream ─────────────────────────────────────────────────────────────

public sealed class WaveInStream : Stream
{
    private readonly WaveIn _waveIn;
    private readonly BlockingCollection<byte[]> _queue = new(64);
    private byte[]? _current;
    private int _offset;
    private long _position;

    public WaveInStream(WaveIn waveIn)
    {
        _waveIn = waveIn;
        _waveIn.DataAvailable += OnData;
    }

    private void OnData(object? sender, WaveInEventArgs e)
    {
        if (_queue.IsAddingCompleted)
            return;
        var chunk = new byte[e.BytesRecorded];
        Buffer.BlockCopy(e.Buffer, 0, chunk, 0, e.BytesRecorded);
        _queue.TryAdd(chunk); // silently drop on overflow
    }

    public override int Read(byte[] buffer, int offset, int count)
    {
        var filled = 0;
        while (filled < count)
        {
            if (_current == null || _offset >= _current.Length)
            {
                try
                {
                    _current = _queue.Take();
                    _offset = 0;
                }
                catch (InvalidOperationException)
                {
                    break;
                } // collection completed
            }
            var toCopy = Math.Min(_current.Length - _offset, count - filled);
            Buffer.BlockCopy(_current, _offset, buffer, offset + filled, toCopy);
            _offset += toCopy;
            filled += toCopy;
        }
        _position += filled;
        return filled;
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            _waveIn.DataAvailable -= OnData;
            _queue.CompleteAdding();
            _waveIn.StopRecording();
            _waveIn.Dispose();
            _queue.Dispose();
        }
        base.Dispose(disposing);
    }

    public override bool CanRead => true;

    public override bool CanSeek => true;
    public override bool CanWrite => false;
    public override long Length => long.MaxValue;
    public override long Position
    {
        get => _position;
        set
        { /* live stream — ignore position sets */
        }
    }

    public override void Flush() { }

    public override long Seek(long offset, SeekOrigin origin) => _position;

    public override void SetLength(long value) { }

    public override void Write(byte[] buffer, int offset, int count) =>
        throw new NotSupportedException();
}
