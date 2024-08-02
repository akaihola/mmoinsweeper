const M1: u64 = 54787;
const M2: u64 = 25867;
const M3: u64 = 9337;

fn get_nth_color(n: u32) -> (u16, u16, u16) {
    let red = ((M1 * n as u64) % 65536) as u16;
    let green = ((M2 * n as u64) % 65536) as u16;
    let blue = ((M3 * n as u64) % 65536) as u16;

    (red, green, blue)
}

pub fn get_player_color_hex(player_id: u32) -> String {
    let (red, green, blue) = get_nth_color(player_id);
    format!("#{:02X}{:02X}{:02X}", red / 256, green / 256, blue / 256)
}
