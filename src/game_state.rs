use std::collections::{HashMap, VecDeque};

use chrono::Utc;
use rand::Rng;
use serde::{Deserialize, Serialize};

fn seconds_since(epoch: u32) -> u32 {
    Utc::now().timestamp() as u32 - epoch
}

const MINE_PROBABILITY: f64 = 0.2;

#[derive(Serialize, Deserialize, Clone)]
pub struct Tile {
    pub x: i64,
    pub y: i64,
    pub is_mine: bool,
    pub uncovered: u32,  // seconds since beginning of game, zero = not uncovered
    pub adjacent_mines: u8,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Player {
    pub id: u32,
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
    pub tiles: Vec<Tile>,
    pub players: Vec<Player>,
}

pub struct GameState {
    pub epoch: u32,
    pub board: HashMap<(i64, i64), Tile>,
    pub players: HashMap<u32, Player>,
    pub next_player_id: u32,
    pub playing: bool,
    uncover_history: VecDeque<((i64, i64), u32)>, // ((x, y), timestamp)
}

impl GameState {
    pub fn new(width: i64, height: i64) -> Self {
        let mut board = HashMap::new();
        let mut rng = rand::thread_rng();

        for x in 0..width {
            for y in 0..height {
                let is_mine = rng.gen_bool(MINE_PROBABILITY);
                board.insert((x, y), Tile {
                    x,
                    y,
                    is_mine,
                    uncovered: 0,
                    adjacent_mines: 0,
                });
            }
        }

        for x in 0..width {
            for y in 0..height {
                let mut adjacent_mines = 0;
                for dx in -1..=1 {
                    for dy in -1..=1 {
                        if dx == 0 && dy == 0 {
                            continue;
                        }
                        if let Some(tile) = board.get(&(x + dx, y + dy)) {
                            if tile.is_mine {
                                adjacent_mines += 1;
                            }
                        }
                    }
                }
                if let Some(tile) = board.get_mut(&(x, y)) {
                    tile.adjacent_mines = adjacent_mines;
                }
            }
        }

        GameState {
            epoch: seconds_since(0),
            board,
            players: HashMap::new(),
            next_player_id: 1,
            playing: false,
            uncover_history: VecDeque::new(),
        }
    }

    pub fn process_action(&mut self, action: PlayerAction) -> GameStateResponse {
        let mut last_action_tile = (0, 0);
        match action.action_type.as_str() {
            "join" => {
                let player_id = self.next_player_id;
                self.next_player_id += 1;
                let color = format!("#{:06x}", rand::thread_rng().gen_range(0..0xFFFFFF));
                self.players.insert(player_id, Player {
                    id: player_id,
                    color,
                    score: 0,
                });
                // Find a random starting location for the player. The starting tile must not be a mine.
                // The orthogonally and diagonally adjacent tiles must not be mines either.
                'find_starting_tile:
                loop {
                    let x = rand::thread_rng().gen_range(0..1000);
                    let y = rand::thread_rng().gen_range(0..1000);
                    let mut valid = true;
                    'check_adjacent:
                    for dx in -1..=1 {
                        for dy in -1..=1 {
                            if let Some(tile) = self.board.get(&(x + dx, y + dy)) {
                                if tile.is_mine {
                                    valid = false;
                                    break 'check_adjacent;
                                }
                            }
                        }
                    }
                    if valid {
                        last_action_tile = (x, y);
                        break 'find_starting_tile;
                    }
                }
                self.playing = true;
                self.uncover(last_action_tile.0, last_action_tile.1);

                // Calculate size of visible area from action.visible_{top,bottom,left,right} fields
                // and set the visible area to be centered around the starting tile.
                let visible_width = action.visible_right - action.visible_left + 1;
                let visible_height = action.visible_bottom - action.visible_top + 1;
                let visible_left = last_action_tile.0 - visible_width / 2;
                let visible_right = last_action_tile.0 + visible_width / 2;
                let visible_top = last_action_tile.1 - visible_height / 2;
                let visible_bottom = last_action_tile.1 + visible_height / 2;
                // Filter tiles within the visible bounds for the joining player,
                // and make sure to only return uncovered tiles
                let visible_tiles = self.board.values()
                    .filter(|tile| {
                        tile.x >= visible_left && tile.x <= visible_right &&
                            tile.y >= visible_top && tile.y <= visible_bottom &&
                            tile.uncovered > 0
                    })
                    .cloned()
                    .collect();

                return GameStateResponse {
                    update_top: visible_top,
                    update_bottom: visible_bottom,
                    update_left: visible_left,
                    update_right: visible_right,
                    last_action_x: last_action_tile.0,
                    last_action_y: last_action_tile.1,
                    tiles: visible_tiles,
                    players: self.players.values().cloned().collect(),
                };
            }
            "uncover" => {
                if let Some(tile) = self.board.get_mut(&(action.x, action.y)) {
                    match (self.playing, tile.uncovered, tile.is_mine) {
                        (true, 0, true) => {
                            // Game over
                            tile.uncovered = seconds_since(self.epoch);
                            self.playing = false;
                        }
                        (true, 0, false) => {
                            tile.uncovered = seconds_since(self.epoch);
                            if let Some(player) = self.players.get_mut(&action.player_id) {
                                player.score += 1;
                            }
                        }
                        _ => {}
                    }
                }
                last_action_tile = (action.x, action.y);
            }
            _ => {}
        }

        // Filter tiles within the visible bounds for the joining player,
        // and make sure to only return uncovered tiles
        let visible_tiles = self.board.values()
            .filter(|tile| {
                tile.x >= action.visible_left && tile.x <= action.visible_right &&
                    tile.y >= action.visible_top && tile.y <= action.visible_bottom &&
                    tile.uncovered > 0
            })
            .cloned()
            .collect();

        GameStateResponse {
            update_top: action.visible_top,
            update_bottom: action.visible_bottom,
            update_left: action.visible_left,
            update_right: action.visible_right,
            last_action_x: last_action_tile.0,
            last_action_y: last_action_tile.1,
            tiles: visible_tiles,
            players: self.players.values().cloned().collect(),
        }
    }

    pub fn uncover(&mut self, x: i64, y: i64) {
        if let Some(tile) = self.board.get_mut(&(x, y)) {
            if tile.uncovered > 0 {
                return;
            }
            let current_time = seconds_since(self.epoch);
            tile.uncovered = current_time;
            self.uncover_history.push_back(((x, y), current_time));
            // Remove items older than 10 minutes (600 seconds) unless the list is shorter than 100 items
            while let Some((_, timestamp)) = self.uncover_history.front() {
                if current_time - timestamp > 600 && self.uncover_history.len() > 100 {
                    self.uncover_history.pop_front();
                } else {
                    break;
                }
            }
        }
    }
}

