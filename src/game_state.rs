use std::collections::{HashMap, VecDeque};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

use chrono::Utc;
use rand::Rng;
use serde::{Deserialize, Serialize};

fn seconds_since(epoch: u32) -> u32 {
    Utc::now().timestamp() as u32 - epoch
}

const MINE_PROBABILITY: f64 = 0.2;

pub struct DbTile {
    pub uncovered: u32,  // seconds since beginning of game, zero = not uncovered
    pub player_id: u32,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ClientTile {
    pub x: i64,
    pub y: i64,
    pub player_id: u32,
    pub adjacent_mines: i8,
    pub is_mine: bool,
}

#[derive(Clone)]
pub struct DbPlayer {
    pub color: String,
    pub score: u32,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ClientPlayer {
    pub color: String,
    pub score: u32,
}

#[derive(Serialize, Deserialize)]
pub struct PlayerAction {
    pub player_id: u32,
    pub action_type: String,
    pub x: i64,
    pub y: i64,
    pub visible_top: i64,
    pub visible_bottom: i64,
    pub visible_left: i64,
    pub visible_right: i64,
}

#[derive(Serialize, Deserialize)]
pub struct GameStateResponse {
    pub update_top: i64,
    pub update_bottom: i64,
    pub update_left: i64,
    pub update_right: i64,
    pub last_action_x: i64,
    pub last_action_y: i64,
    pub tiles: Vec<ClientTile>,
    pub players: HashMap<u32, ClientPlayer>,
}

pub struct GameState {
    pub epoch: u32,
    pub board: HashMap<(i64, i64), DbTile>,
    pub players: HashMap<u32, DbPlayer>,
    pub next_player_id: u32,
    pub player_id: u32,  // zero = not yet playing or game over
    uncover_history: VecDeque<(i64, i64)>,  // (x, y)
}

impl GameState {
    pub fn new() -> Self {
        let board = HashMap::new();
        let epoch = seconds_since(0) - 1;

        GameState {
            epoch,
            board,
            players: HashMap::new(),
            next_player_id: 1,
            player_id: 0,  // not yet playing
            uncover_history: VecDeque::new(),
        }
    }

    pub fn process_action(&mut self, action: PlayerAction) -> GameStateResponse {
        let mut last_action_tile = (0, 0);
        match action.action_type.as_str() {
            "join" => {
                self.player_id = self.next_player_id;  // non-zero = playing
                self.next_player_id += 1;
                let color = format!("#{:06x}", rand::thread_rng().gen_range(0..0xFFFFFF));
                self.players.insert(self.player_id, DbPlayer {
                    color,
                    score: 0,
                });
                last_action_tile = self.find_random_start_position();
                self.uncover(last_action_tile.0, last_action_tile.1);

                // Calculate size of visible area from action.visible_{top,bottom,left,right} fields
                // and set the visible area to be centered around the starting tile.
                let visible_width = action.visible_right - action.visible_left + 1;
                let visible_height = action.visible_bottom - action.visible_top + 1;
                let visible_left = last_action_tile.0 - visible_width / 2;
                let visible_right = last_action_tile.0 + visible_width / 2;
                let visible_top = last_action_tile.1 - visible_height / 2;
                let visible_bottom = last_action_tile.1 + visible_height / 2;

                return GameStateResponse {
                    update_top: visible_top,
                    update_bottom: visible_bottom,
                    update_left: visible_left,
                    update_right: visible_right,
                    last_action_x: last_action_tile.0,
                    last_action_y: last_action_tile.1,
                    tiles: self.visible_tiles(visible_top, visible_bottom, visible_left, visible_right),
                    players: self.players_response(),
                };
            }
            "uncover" => {
                match (self.player_id,
                       self.board.get_mut(&(action.x, action.y)),
                       is_mine(self.epoch, action.x, action.y, MINE_PROBABILITY)) {
                    (0, _, _) => {}  // not yet playing or game over
                    (_, None, true) => {
                        self.uncover(action.x, action.y);
                        self.player_id = 0;  // Game over
                    }
                    (_, None, false) => {
                        self.uncover(action.x, action.y);
                        if let Some(player) = self.players.get_mut(&action.player_id) {
                            player.score += 1;
                        }
                    }
                    _ => {}  // already uncovered
                }
                last_action_tile = (action.x, action.y);
            }
            _ => {}
        }

        GameStateResponse {
            update_top: action.visible_top,
            update_bottom: action.visible_bottom,
            update_left: action.visible_left,
            update_right: action.visible_right,
            last_action_x: last_action_tile.0,
            last_action_y: last_action_tile.1,
            tiles: self.visible_tiles(action.visible_top, action.visible_bottom, action.visible_left, action.visible_right),
            players: self.players_response(),
        }
    }

    pub fn players_response(&self) -> HashMap<u32, ClientPlayer> {
        self.players.iter().map(|(&id, player)| {
            (id, ClientPlayer {
                color: player.color.clone(),
                score: player.score,
            })
        }).collect()
    }

    pub fn visible_tiles(&self, top: i64, bottom: i64, left: i64, right: i64) -> Vec<ClientTile> {
        self.board.iter().filter_map(|(&(x, y), db_tile)| {
            if x >= left && x <= right &&
                y >= top && y <= bottom {
                Some(ClientTile {
                    x,
                    y,
                    player_id: db_tile.player_id,
                    adjacent_mines: self.adjacent_mines(x, y),
                    is_mine: self.is_mine(x, y),
                })
            } else {
                None
            }
        }).collect()
    }

    pub fn uncover(&mut self, x: i64, y: i64) {
        if self.board.contains_key(&(x, y)) { return; }  // already uncovered
        let current_time = seconds_since(self.epoch);
        self.board.insert((x, y), DbTile {
            player_id: self.player_id,
            uncovered: current_time,
        });
        println!("There were {} recent tiles, pushing ({}, {})", self.uncover_history.len(), x, y);
        self.uncover_history.push_back((x, y));
        println!("There are now {} recent tiles", self.uncover_history.len());
        // Remove items older than 10 minutes (600 seconds) unless the list is shorter than 100 items
        while let Some(x_y) = self.uncover_history.front() {
            let timestamp = self.board.get(x_y).unwrap().uncovered;
            if current_time - timestamp > 600 && self.uncover_history.len() > 100 {
                println!("Purging old tile from {}, now is {}", timestamp, current_time);
                self.uncover_history.pop_front();
                println!("There are now {} recent tiles", self.uncover_history.len());
            } else {
                break;
            }
        }
    }

    // Add a function to find a random starting position for a player
    // that is not a mine and has no adjacent mines
    // and at 10 tiles away from the nearest uncovered tile.
    // Pick a random recently uncovered tile, and walk in a random direction until a tile fulfilling
    // the criteria is found.
    pub fn find_random_start_position(&self) -> (i64, i64) {
        // Pick a random recently uncovered tile
        let mut rng = rand::thread_rng();
        println!("There are {} recent tiles", self.uncover_history.len());
        let (x, y) = if self.uncover_history.is_empty() {
            (0, 0)
        } else {
            let random_index = rng.gen_range(0..self.uncover_history.len());
            self.uncover_history.iter().nth(random_index).unwrap().clone()
        };
        println!("Picked tile ({}, {})", x, y);
        // Pick a random angle and use a line drawing algorithm to walk in that direction until a
        // suitable tile is found.
        let angle = rng.gen_range(0.0..std::f64::consts::PI * 2.0);
        println!("Picked angle {}", angle);
        for (dx, dy) in bresenham_line_towards_angle(angle) {
            println!("Checking tile ({}, {})", x + dx, y + dy);
            if !self.is_mine(x + dx, y + dy) && self.adjacent_mines(x + dx, y + dy) == 0 {
                return (x + dx, y + dy);
            }
        }
        (0, 0)
    }

    pub fn is_mine(&self, x: i64, y: i64) -> bool {
        is_mine(self.epoch, x, y, MINE_PROBABILITY)
    }

    pub fn adjacent_mines(&self, x: i64, y: i64) -> i8 {
        let mut count = 0;
        for dx in -1..=1 {
            for dy in -1..=1 {
                if self.is_mine(x + dx, y + dy) {
                    count += 1;
                }
            }
        }
        count
    }
}

fn bresenham_line_towards_angle(angle: f64) -> impl Iterator<Item=(i64, i64)> {
    let dx = (angle.cos() * 10000.0).round() as i32;
    let dy = (angle.sin() * 10000.0).round() as i32;
    let mut x = 0;
    let mut y = 0;
    let dx_abs = dx.abs();
    let dy_abs = dy.abs();
    let x_step = if dx > 0 { 1 } else { -1 };
    let y_step = if dy > 0 { 1 } else { -1 };
    let mut error = 0i32;
    let primary_delta = dx_abs.max(dy_abs);
    let secondary_delta = dx_abs.min(dy_abs);
    let primary_is_x = dx_abs > dy_abs;

    std::iter::from_fn(move || {
        let result = Some((x, y));
        if primary_is_x {
            x += x_step;
            error += secondary_delta;
            if 2 * error >= primary_delta {
                y += y_step;
                error -= primary_delta;
            }
        } else {
            y += y_step;
            error += secondary_delta;
            if 2 * error >= primary_delta {
                x += x_step;
                error -= primary_delta;
            }
        }
        result
    })
}


fn is_mine(seed: u32, x: i64, y: i64, probability: f64) -> bool {
    // Step 1: Combine `x`, `y`, and `s` into a single hash value
    let mut hasher = DefaultHasher::new();
    (seed, x, y).hash(&mut hasher);
    let hash_value = hasher.finish();

    // Step 2: Convert the hash value to a pseudo-random number in [0, 1)
    // Here, we use the maximum value of u64 as a normalization factor
    let random_value = (hash_value as f64) / (u64::MAX as f64);

    // Step 3: Compare the pseudo-random number with `p`
    random_value < probability
}