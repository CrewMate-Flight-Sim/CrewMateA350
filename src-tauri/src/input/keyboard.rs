use ::windows::Win32::UI::Input::KeyboardAndMouse::{
    GetAsyncKeyState, GetKeyNameTextW, MapVirtualKeyW, MAPVK_VK_TO_VSC_EX,
};

pub const VK_ESCAPE: u16 = 0x1B;
const VK_XBUTTON1: u16 = 0x05;
const VK_XBUTTON2: u16 = 0x06;

// Left/right/middle click would bind the Set button itself; generic Shift/Ctrl/Alt duplicate their L/R codes
const SKIPPED_VKS: [u16; 6] = [0x01, 0x02, 0x04, 0x10, 0x11, 0x12];
// Share scan codes with numpad keys and map back without the E0 prefix, so labels would name the numpad twin
const EXTENDED_VKS: [u16; 17] = [
    0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x2C, 0x2D, 0x2E, 0x5B, 0x5C, 0x5D, 0x6F, 0xA3,
    0xA5,
];

// Works without focus and leaves the key to MSFS, but Windows hides input while an elevated app has focus
pub fn is_down(vk: u16) -> bool {
    unsafe { GetAsyncKeyState(vk as i32) as u16 & 0x8000 != 0 }
}

pub fn pressed_keys() -> Vec<u16> {
    (0x01..=0xFEu16)
        .filter(|vk| !SKIPPED_VKS.contains(vk) && is_down(*vk))
        .collect()
}

pub fn label(vk: u16) -> String {
    match vk {
        VK_XBUTTON1 => "Mouse 4".into(),
        VK_XBUTTON2 => "Mouse 5".into(),
        _ => {
            let scan = unsafe { MapVirtualKeyW(vk as u32, MAPVK_VK_TO_VSC_EX) };
            let extended = if scan & 0xFF00 == 0xE000 || EXTENDED_VKS.contains(&vk) {
                1 << 24
            } else {
                0
            };
            let lparam = (((scan & 0xFF) << 16) | extended) as i32;
            let mut buf = [0u16; 64];
            let len = unsafe { GetKeyNameTextW(lparam, &mut buf) };
            if len > 0 {
                String::from_utf16_lossy(&buf[..len as usize])
            } else {
                format!("Key {vk:#04X}")
            }
        }
    }
}
