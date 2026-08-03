use crate::audio::audio_devices;
use rodio::{buffer::SamplesBuffer, Decoder, OutputStream, OutputStreamHandle, Sink, Source};
use std::collections::HashMap;
use std::rc::Rc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

// ── Silence trimming ──────────────────────────────────────────────────────────

struct DecodedSound {
    samples: Vec<i16>,
    channels: u16,
    sample_rate: u32,
}

fn trim_silence(samples: &[i16], threshold: i16, pad_samples: usize) -> Vec<i16> {
    let start = samples
        .iter()
        .position(|s| s.unsigned_abs() > threshold as u16)
        .unwrap_or(0);
    let end = samples
        .iter()
        .rposition(|s| s.unsigned_abs() > threshold as u16)
        .unwrap_or(samples.len().saturating_sub(1));
    let padded_start = start.saturating_sub(pad_samples);
    let padded_end = (end + pad_samples).min(samples.len().saturating_sub(1));
    samples[padded_start..=padded_end].to_vec()
}

fn load_and_trim<P: AsRef<std::path::Path>>(
    path: P,
) -> Result<DecodedSound, Box<dyn std::error::Error + Send + Sync>> {
    use std::fs::File;
    use std::io::BufReader;
    let file = File::open(path)?;
    let decoder = Decoder::new(BufReader::new(file))?;
    let channels = decoder.channels();
    let sample_rate = decoder.sample_rate();
    let raw: Vec<i16> = decoder.collect();
    let samples = trim_silence(&raw, 200, 4800);
    Ok(DecodedSound {
        samples,
        channels,
        sample_rate,
    })
}

// ── Queue item ────────────────────────────────────────────────────────────────

/// A single item placed on the audio queue.
/// `Single` plays one file (silence-trimmed); `Sequence` plays several back-to-back (trimmed).
pub enum QueueItem {
    Single {
        path: std::path::PathBuf,
        volume: f32,
    },
    Sequence {
        paths: Vec<std::path::PathBuf>,
        volume: f32,
    },
}

// ── AudioPlayer ───────────────────────────────────────────────────────────────

pub struct AudioPlayer {
    _stream: Rc<OutputStream>,
    pub is_playing: Arc<AtomicBool>,
    /// Send items here to enqueue them for playback.
    pub queue_tx: std::sync::mpsc::Sender<QueueItem>,
}

unsafe impl Send for AudioPlayer {}
unsafe impl Sync for AudioPlayer {}

impl AudioPlayer {
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        Self::with_device(None)
    }

    pub fn with_device(device: Option<String>) -> Result<Self, Box<dyn std::error::Error>> {
        let (stream, stream_handle) = match device.as_deref() {
            None | Some("default") => OutputStream::try_default()?,
            Some(idx) => {
                let devices = audio_devices::list_output_devices()?;
                let found = devices
                    .into_iter()
                    .find(|d| d.index == idx)
                    .ok_or_else(|| format!("Output device with index {} not found", idx))?;
                OutputStream::try_from_device(&found.device)?
            }
        };

        let stream_handle = Arc::new(stream_handle);
        let is_playing = Arc::new(AtomicBool::new(false));

        let (queue_tx, queue_rx) = std::sync::mpsc::channel::<QueueItem>();

        // Background worker: drains the queue sequentially.
        {
            let stream_handle = stream_handle.clone();
            let is_playing = is_playing.clone();
            std::thread::spawn(move || {
                for item in queue_rx {
                    match item {
                        QueueItem::Single { path, volume } => {
                            let _ = play_single_blocking(&stream_handle, &is_playing, path, volume);
                        }
                        QueueItem::Sequence { paths, volume } => {
                            let _ =
                                play_sequence_trimmed(&stream_handle, &is_playing, paths, volume);
                        }
                    }
                }
            });
        }

        Ok(Self {
            _stream: Rc::new(stream),
            is_playing,
            queue_tx,
        })
    }

    /// Enqueue a single file for playback. Returns immediately.
    pub fn play_from_path<P: AsRef<std::path::Path>>(
        &self,
        path: P,
        volume: f32,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let volume = volume.clamp(0.0, 10.0);
        self.queue_tx
            .send(QueueItem::Single {
                path: path.as_ref().to_path_buf(),
                volume,
            })
            .map_err(|e| Box::new(e) as Box<dyn std::error::Error>)
    }

    /// Enqueue a sequence of files for gapless playback. Returns immediately.
    pub fn play_sequence<P: AsRef<std::path::Path>>(
        &self,
        paths: Vec<P>,
        volume: f32,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let volume = volume.clamp(0.0, 10.0);
        self.queue_tx
            .send(QueueItem::Sequence {
                paths: paths.iter().map(|p| p.as_ref().to_path_buf()).collect(),
                volume,
            })
            .map_err(|e| Box::new(e) as Box<dyn std::error::Error>)
    }

    pub fn is_playing(&self) -> bool {
        self.is_playing.load(Ordering::SeqCst)
    }
}

// ── Blocking helpers (called from the worker thread) ─────────────────────────

/// Play a single file synchronously; blocks until done. Trims silence from file.
fn play_single_blocking(
    stream_handle: &OutputStreamHandle,
    is_playing: &Arc<AtomicBool>,
    path: std::path::PathBuf,
    volume: f32,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let decoded = load_and_trim(&path)?;
    let volume = volume.clamp(0.0, 10.0);

    let sink = Sink::try_new(stream_handle)
        .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;

    sink.append(
        SamplesBuffer::new(decoded.channels, decoded.sample_rate, decoded.samples).amplify(volume),
    );

    is_playing.store(true, Ordering::SeqCst);
    sink.sleep_until_end();
    is_playing.store(false, Ordering::SeqCst);
    Ok(())
}

/// Decode, silence-trim, and play `paths` back-to-back as a single gapless sequence.
/// Blocks until the last sample finishes. Intended to be called from the worker thread
/// or `spawn_blocking`.
pub fn play_sequence_trimmed(
    stream_handle: &OutputStreamHandle,
    is_playing: &Arc<AtomicBool>,
    paths: Vec<std::path::PathBuf>,
    volume: f32,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    if paths.is_empty() {
        return Ok(());
    }

    let volume = volume.clamp(0.0, 10.0);

    // Cache decoded sounds to avoid reloading the same file multiple times
    let mut cache: HashMap<String, DecodedSound> = HashMap::new();
    for path in &paths {
        let key = path.to_string_lossy().to_string();
        if let std::collections::hash_map::Entry::Vacant(e) = cache.entry(key) {
            e.insert(load_and_trim(path)?);
        }
    }

    let sink = Sink::try_new(stream_handle)
        .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;
    for path in &paths {
        let key = path.to_string_lossy().to_string();
        if let Some(s) = cache.get(&key) {
            // Note: Each sound could have different sample rate/channels.
            // SamplesBuffer takes ownership of samples, so we clone them here.
            // This is acceptable because the cache already avoids re-decoding.
            sink.append(
                SamplesBuffer::new(s.channels, s.sample_rate, s.samples.clone()).amplify(volume),
            );
        }
    }

    is_playing.store(true, Ordering::SeqCst);
    sink.sleep_until_end();
    is_playing.store(false, Ordering::SeqCst);
    Ok(())
}
