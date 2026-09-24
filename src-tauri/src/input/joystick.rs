use std::ffi::c_void;
use std::time::{Duration, Instant};

use ::windows::core::{IUnknown, Interface, BOOL, GUID};
use ::windows::Win32::Devices::HumanInterfaceDevice::{
    DirectInput8Create, IDirectInput8W, IDirectInputDevice8W, DI8DEVCLASS_GAMECTRL, DIDATAFORMAT,
    DIDEVICEINSTANCEW, DIDFT_ANYINSTANCE, DIDFT_BUTTON, DIDFT_POV, DIDF_ABSAXIS,
    DIEDFL_ATTACHEDONLY, DIENUM_CONTINUE, DIOBJECTDATAFORMAT, DIRECTINPUT_VERSION,
    DISCL_BACKGROUND, DISCL_NONEXCLUSIVE, GUID_POV,
};
use ::windows::Win32::Foundation::{HINSTANCE, HWND};
use ::windows::Win32::System::LibraryLoader::GetModuleHandleW;

use super::{JoystickControl, PovDir};

const MAX_POVS: usize = 4;
const MAX_BUTTONS: usize = 128;
// Missing from windows-rs; value from dinput.h
const DIDFT_OPTIONAL: u32 = 0x8000_0000;
// EnumDevices can stall on some HID stacks, so it only runs while a wanted device is absent
const REENUMERATE_EVERY: Duration = Duration::from_secs(3);

// c_dfDIJoystick2 is static data in dinput8.lib that windows-rs can't link, so the layout is ours
#[repr(C)]
#[derive(Clone, Copy)]
pub struct JoyState {
    povs: [u32; MAX_POVS],
    buttons: [u8; MAX_BUTTONS],
}

impl Default for JoyState {
    fn default() -> Self {
        Self {
            povs: [u32::MAX; MAX_POVS],
            buttons: [0; MAX_BUTTONS],
        }
    }
}

impl JoyState {
    pub fn is_down(&self, control: JoystickControl) -> bool {
        match control {
            JoystickControl::Button { index } => self
                .buttons
                .get(index as usize)
                .is_some_and(|b| b & 0x80 != 0),
            JoystickControl::Pov { index, dir } => self
                .povs
                .get(index as usize)
                .is_some_and(|&v| pov_dirs(v).contains(&dir)),
        }
    }

    pub fn pressed(&self) -> Vec<JoystickControl> {
        let buttons = (0..MAX_BUTTONS)
            .filter(|&i| self.buttons[i] & 0x80 != 0)
            .map(|i| JoystickControl::Button { index: i as u8 });
        let povs = (0..MAX_POVS).flat_map(|i| {
            pov_dirs(self.povs[i])
                .into_iter()
                .map(move |dir| JoystickControl::Pov {
                    index: i as u8,
                    dir,
                })
        });
        buttons.chain(povs).collect()
    }
}

fn pov_dirs(value: u32) -> Vec<PovDir> {
    if value & 0xFFFF == 0xFFFF {
        return Vec::new();
    }
    let a = value % 36000;
    let mut dirs = Vec::new();
    if !(9000..=27000).contains(&a) {
        dirs.push(PovDir::Up);
    }
    if a > 0 && a < 18000 {
        dirs.push(PovDir::Right);
    }
    if a > 9000 && a < 27000 {
        dirs.push(PovDir::Down);
    }
    if a > 18000 {
        dirs.push(PovDir::Left);
    }
    dirs
}

pub struct Device {
    pub guid: String,
    pub name: String,
    pub state: JoyState,
    dev: IDirectInputDevice8W,
}

pub struct Joysticks {
    di: Option<IDirectInput8W>,
    hwnd: HWND,
    pub devices: Vec<Device>,
    last_enum: Option<Instant>,
}

impl Joysticks {
    pub fn new(hwnd: isize) -> Self {
        let di = unsafe { create_direct_input() }
            .inspect_err(|e| {
                log::error!("[Input] DirectInput unavailable, joystick bindings disabled: {e}")
            })
            .ok();
        Self {
            di,
            hwnd: HWND(hwnd as *mut c_void),
            devices: Vec::new(),
            last_enum: None,
        }
    }

    pub fn find(&self, guid: &str, name: &str) -> Option<&Device> {
        self.devices
            .iter()
            .find(|d| d.guid == guid)
            .or_else(|| self.devices.iter().find(|d| d.name == name))
    }

    pub fn enumerate_now(&mut self) {
        self.last_enum = None;
    }

    // Opens every attached controller while capturing, otherwise only the bound ones
    pub fn sync(&mut self, wanted: &[(&str, &str)], all: bool) {
        if !all {
            self.devices
                .retain(|d| wanted.iter().any(|(g, n)| d.guid == *g || d.name == *n));
        }
        let missing = all || wanted.iter().any(|(g, n)| self.find(g, n).is_none());
        if !missing
            || self
                .last_enum
                .is_some_and(|t| t.elapsed() < REENUMERATE_EVERY)
        {
            return;
        }
        self.last_enum = Some(Instant::now());
        let Some(di) = self.di.as_ref() else { return };

        for inst in unsafe { enumerate(di) } {
            let guid = format!("{:?}", inst.guidInstance);
            let name = wide_to_string(&inst.tszProductName);
            let is_open = self.devices.iter().any(|d| d.guid == guid);
            let is_wanted = all || wanted.iter().any(|(g, n)| *g == guid || *n == name);
            if is_open || !is_wanted {
                continue;
            }
            match unsafe { open(di, self.hwnd, &inst.guidInstance) } {
                Ok(dev) => {
                    log::info!("[Input] Opened {name}");
                    self.devices.push(Device {
                        guid,
                        name,
                        state: JoyState::default(),
                        dev,
                    });
                }
                Err(e) => log::warn!("[Input] Failed to open {name}: {e}"),
            }
        }
    }

    // A device that stops answering is dropped and picked up again by the next enumeration
    pub fn poll(&mut self) {
        self.devices
            .retain_mut(|d| match unsafe { read_state(&d.dev) } {
                Ok(state) => {
                    d.state = state;
                    true
                }
                Err(e) => {
                    log::warn!("[Input] Lost {}: {e}", d.name);
                    false
                }
            });
    }
}

unsafe fn create_direct_input() -> ::windows::core::Result<IDirectInput8W> {
    let module = GetModuleHandleW(None)?;
    let mut raw: *mut c_void = std::ptr::null_mut();
    DirectInput8Create(
        HINSTANCE(module.0),
        DIRECTINPUT_VERSION,
        &IDirectInput8W::IID,
        &mut raw,
        None::<&IUnknown>,
    )?;
    Ok(IDirectInput8W::from_raw(raw))
}

unsafe extern "system" fn collect_device(inst: *mut DIDEVICEINSTANCEW, ctx: *mut c_void) -> BOOL {
    (*(ctx as *mut Vec<DIDEVICEINSTANCEW>)).push(*inst);
    BOOL(DIENUM_CONTINUE as i32)
}

unsafe fn enumerate(di: &IDirectInput8W) -> Vec<DIDEVICEINSTANCEW> {
    let mut list: Vec<DIDEVICEINSTANCEW> = Vec::new();
    if let Err(e) = di.EnumDevices(
        DI8DEVCLASS_GAMECTRL,
        Some(collect_device),
        &mut list as *mut _ as *mut c_void,
        DIEDFL_ATTACHEDONLY,
    ) {
        log::warn!("[Input] Device enumeration failed: {e}");
    }
    list
}

unsafe fn open(
    di: &IDirectInput8W,
    hwnd: HWND,
    guid: &GUID,
) -> ::windows::core::Result<IDirectInputDevice8W> {
    let mut dev = None;
    di.CreateDevice(guid, &mut dev, None::<&IUnknown>)?;
    let dev = dev.ok_or_else(::windows::core::Error::empty)?;

    let mut objects = data_format_objects();
    let mut format = DIDATAFORMAT {
        dwSize: size_of::<DIDATAFORMAT>() as u32,
        dwObjSize: size_of::<DIOBJECTDATAFORMAT>() as u32,
        dwFlags: DIDF_ABSAXIS,
        dwDataSize: size_of::<JoyState>() as u32,
        dwNumObjs: objects.len() as u32,
        rgodf: objects.as_mut_ptr(),
    };
    dev.SetDataFormat(&mut format)?;
    // Background + non-exclusive keeps input flowing while MSFS has focus and shares the device with it
    dev.SetCooperativeLevel(hwnd, DISCL_BACKGROUND | DISCL_NONEXCLUSIVE)?;
    let _ = dev.Acquire();
    Ok(dev)
}

fn data_format_objects() -> Vec<DIOBJECTDATAFORMAT> {
    let povs = (0..MAX_POVS).map(|i| DIOBJECTDATAFORMAT {
        pguid: &GUID_POV,
        dwOfs: (i * 4) as u32,
        dwType: DIDFT_POV | DIDFT_ANYINSTANCE | DIDFT_OPTIONAL,
        dwFlags: 0,
    });
    let buttons = (0..MAX_BUTTONS).map(|i| DIOBJECTDATAFORMAT {
        pguid: std::ptr::null(),
        dwOfs: (MAX_POVS * 4 + i) as u32,
        dwType: DIDFT_BUTTON | DIDFT_ANYINSTANCE | DIDFT_OPTIONAL,
        dwFlags: 0,
    });
    povs.chain(buttons).collect()
}

unsafe fn read_state(dev: &IDirectInputDevice8W) -> ::windows::core::Result<JoyState> {
    if dev.Poll().is_err() {
        dev.Acquire()?;
        let _ = dev.Poll();
    }
    let mut state = JoyState::default();
    dev.GetDeviceState(
        size_of::<JoyState>() as u32,
        &mut state as *mut JoyState as *mut c_void,
    )?;
    Ok(state)
}

fn wide_to_string(buf: &[u16]) -> String {
    let len = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
    String::from_utf16_lossy(&buf[..len]).trim().to_string()
}
