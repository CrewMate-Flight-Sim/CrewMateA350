use crate::audio::audio_devices;
use rodio::{buffer::SamplesBuffer, Decoder, OutputStream, Sink, Source};
use std::rc::Rc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread::JoinHandle;

struct DecodedSound {
    samples: Vec<i16>,
    channels: u16,
    sample_rate: u32,
}

fn trim_silence(samples: &[i16], threshold: i16, pad_samples: usize) -> Vec<i16> {
    if samples.is_empty() {
        return Vec::new();
    }

    let start = samples
        .iter()
        .position(|s| s.unsigned_abs() > threshold as u16)
        .unwrap_or(0);
    let end = samples
        .iter()
        .rposition(|s| s.unsigned_abs() > threshold as u16)
        .unwrap_or(samples.len().saturating_sub(1));

    let len = end.saturating_sub(start) + 1;
    let padded_start = start.saturating_sub(pad_samples);
    let padded_end = (padded_start + len + pad_samples * 2).min(samples.len());

    samples[padded_start..padded_end].to_vec()
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
    // 15ms padding, scaled to this file's sample rate.
    let pad_samples = (sample_rate as f32 * 0.04) as usize;
    let samples = trim_silence(&raw, 200, pad_samples);
    Ok(DecodedSound {
        samples,
        channels,
        sample_rate,
    })
}

fn apply_crossfade(a: &[i16], b: &[i16], overlap_samples: usize) -> Vec<i16> {
    if overlap_samples == 0 || a.len() < overlap_samples || b.len() < overlap_samples {
        let mut result = Vec::with_capacity(a.len() + b.len());
        result.extend_from_slice(a);
        result.extend_from_slice(b);
        return result;
    }

    let mut result = Vec::with_capacity(a.len() + b.len() - overlap_samples);

    result.extend_from_slice(&a[..a.len() - overlap_samples]);

    for i in 0..overlap_samples {
        let gain_a = 1.0 - (i as f32 / overlap_samples as f32);
        let gain_b = i as f32 / overlap_samples as f32;
        let va = a[a.len() - overlap_samples + i] as f32 * gain_a;
        let vb = b[i] as f32 * gain_b;
        let mixed = (va + vb).round() as i16;
        result.push(mixed);
    }

    result.extend_from_slice(&b[overlap_samples..]);
    result
}

fn apply_volume(mut decoded: DecodedSound, volume: f32) -> PendingSound {
    let vol = volume.clamp(0.0, 10.0);
    for s in &mut decoded.samples {
        *s = (*s as f32 * vol).round() as i16;
    }
    PendingSound {
        samples: decoded.samples,
        channels: decoded.channels,
        sample_rate: decoded.sample_rate,
    }
}

// ── Queue item (what callers send in) ────────────────────────────────

pub enum QueueItem {
    Single {
        path: std::path::PathBuf,
        volume: f32,
    },
    Sequence {
        paths: Vec<std::path::PathBuf>,
        volume: f32,
    },
    Stop,
}

struct PendingSound {
    samples: Vec<i16>,
    channels: u16,
    sample_rate: u32,
}

// What the decode thread hands to the playback thread — fully decoded,
// trimmed, and volume-scaled PCM, ready to append to the sink.
enum PlaybackItem {
    Sound(PendingSound),
    Sequence(Vec<PendingSound>),
    Stop,
}

// ── AudioPlayer ──────────────────────────────────────

pub struct AudioPlayer {
    _stream: Rc<OutputStream>,
    pub is_playing: Arc<AtomicBool>,
    pub queue_tx: std::sync::mpsc::Sender<QueueItem>,
    decode_handle: Option<JoinHandle<()>>,
    worker_handle: Option<JoinHandle<()>>,
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
        // Bounded to 1: decode thread stays exactly one item ahead of playback.
        let (decoded_tx, decoded_rx) = std::sync::mpsc::sync_channel::<PlaybackItem>(1);

        // Decode thread: does all file I/O / decoding off the playback
        // thread, so it naturally decodes the next item while the
        // playback thread is still blocked playing the current one.
        let decode_handle = std::thread::spawn(move || {
            for item in queue_rx {
                match item {
                    QueueItem::Stop => {
                        let _ = decoded_tx.send(PlaybackItem::Stop);
                        break;
                    }
                    QueueItem::Single { path, volume } => {
                        if let Ok(decoded) = load_and_trim(&path) {
                            let sound = apply_volume(decoded, volume);
                            if decoded_tx.send(PlaybackItem::Sound(sound)).is_err() {
                                break;
                            }
                        }
                    }
                    QueueItem::Sequence { paths, volume } => {
                        let mut sounds = Vec::with_capacity(paths.len());
                        for path in &paths {
                            if let Ok(decoded) = load_and_trim(path) {
                                sounds.push(apply_volume(decoded, volume));
                            }
                        }
                        if !sounds.is_empty()
                            && decoded_tx.send(PlaybackItem::Sequence(sounds)).is_err()
                        {
                            break;
                        }
                    }
                }
            }
        });

        // Playback thread: only touches the sink. Blocking on
        // sleep_until_end() is fine since decoding happens elsewhere.
        let is_playing_worker = is_playing.clone();
        let worker_handle = std::thread::spawn(move || {
            let sink = Sink::try_new(&stream_handle).expect("Failed to create audio sink");

            for item in decoded_rx {
                match item {
                    PlaybackItem::Stop => break,
                    PlaybackItem::Sound(sound) => play_pcm(&sink, &is_playing_worker, vec![sound]),
                    PlaybackItem::Sequence(sounds) => play_pcm(&sink, &is_playing_worker, sounds),
                }
            }
        });

        Ok(Self {
            _stream: Rc::new(stream),
            is_playing,
            queue_tx,
            decode_handle: Some(decode_handle),
            worker_handle: Some(worker_handle),
        })
    }

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

    pub fn stop(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        let _ = self.queue_tx.send(QueueItem::Stop);
        if let Some(handle) = self.decode_handle.take() {
            let _ = handle.join();
        }
        if let Some(handle) = self.worker_handle.take() {
            let _ = handle.join();
        }
        self.is_playing.store(false, Ordering::SeqCst);
        Ok(())
    }
}

impl Drop for AudioPlayer {
    fn drop(&mut self) {
        let _ = self.queue_tx.send(QueueItem::Stop);
        if let Some(handle) = self.decode_handle.take() {
            let _ = handle.join();
        }
        if let Some(handle) = self.worker_handle.take() {
            let _ = handle.join();
        }
    }
}

/// Plays one or more already-decoded sounds back-to-back (crossfaded when
/// there's more than one), blocking until playback finishes.
fn play_pcm(sink: &Sink, is_playing: &Arc<AtomicBool>, sounds: Vec<PendingSound>) {
    let Some(first) = sounds.first() else { return };
    let channels = first.channels;
    let sample_rate = first.sample_rate;
    let mut combined = first.samples.clone();

    for s in sounds.iter().skip(1) {
        let overlap = (sample_rate as f32 * 0.015) as usize;
        combined = apply_crossfade(&combined, &s.samples, overlap);
    }
    if combined.is_empty() {
        return;
    }

    sink.append(SamplesBuffer::new(channels, sample_rate, combined).amplify(1.0));
    is_playing.store(true, Ordering::SeqCst);
    sink.sleep_until_end();
    is_playing.store(false, Ordering::SeqCst);
}
