use std::collections::{HashMap, VecDeque};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

use chrono::Utc;
use rand::Rng;
use serde::{Deserialize, Serialize};

pub type TileCoordinate = i64;
pub type Position = (TileCoordinate, TileCoordinate);
pub type Area = (Position, Position);

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
    pub position: Position,
    pub player_id: u32,
    pub adjacent_mines: i8,
    pub is_mine: bool,
}

#[derive(Clone)]
pub struct DbPlayer {
    pub token: String,
    pub game_over: bool,
    pub color: String,
    pub score: u32,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ClientPlayer {
    pub color: String,
    pub score: u32,
}

#[derive(Serialize, Deserialize)]
#[serde(tag = "action_type")]
pub enum PlayerAction {
    Join {
        visible_area: Area,
    },
    Update {
        area_to_update: Area,
    },
    Uncover {
        player_id: u32,
        token: String,
        position: Position,
        visible_area: Area,
    },
}

#[derive(Serialize, Deserialize)]
pub enum GameStateResponse {
    Joined {
        player_id: u32,
        token: String,
        update_area: Area,
        tiles: Vec<ClientTile>,
        players: HashMap<u32, ClientPlayer>,
    },
    Updated {
        tiles: Vec<ClientTile>,
        players: HashMap<u32, ClientPlayer>,
    },
    Uncovered {
        tiles: Vec<ClientTile>,
        players: HashMap<u32, ClientPlayer>,
    },
    Error {
        message: String,
    },
}

pub struct GameState {
    pub epoch: u32,
    pub board: HashMap<Position, DbTile>,
    pub players: HashMap<u32, DbPlayer>,
    pub next_player_id: u32,
    uncover_history: VecDeque<Position>,  // (x, y)
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
            uncover_history: VecDeque::new(),
        }
    }

    pub fn handle_join_action(&mut self, visible_area: Area) -> GameStateResponse {
        let player_id = self.next_player_id;  // non-zero = playing
        self.next_player_id += 1;
        self.players.insert(player_id, DbPlayer {
            token: uuid::Uuid::new_v4().to_string(),
            color: format!("#{:06x}", rand::thread_rng().gen_range(0..0xFFFFFF)),
            score: 0,
            game_over: false,
        });
        let start_position = self.find_random_start_position();
        self.uncover(start_position, player_id);

        // Calculate size of visible area from action.visible_{top,bottom,left,right} fields
        // and set the visible area to be centered around the starting tile.
        let visible_width = visible_area.1.0 - visible_area.0.0 + 1;
        let visible_height = visible_area.1.1 - visible_area.0.1 + 1;
        let visible_area = (
            (
                start_position.0 - visible_width / 2,  // left
                start_position.1 - visible_height / 2,  // top
            ),
            (
                start_position.0 + visible_width / 2, // right
                start_position.1 + visible_height / 2, // bottom
            ),
        );

        GameStateResponse::Joined {
            player_id: player_id,
            token: self.players[&player_id].token.clone(),
            update_area: visible_area,
            tiles: self.visible_tiles(visible_area),
            players: self.players_response(),
        }
    }

    pub fn handle_update_action(&self, area_to_update: Area) -> GameStateResponse {
        GameStateResponse::Updated {
            tiles: self.visible_tiles(area_to_update),
            players: self.players_response(),
        }
    }

    pub fn handle_uncover_action(&mut self, player_id: u32, token: String, position: Position, visible_area: Area) -> GameStateResponse {
        if self.player_valid_and_playing(player_id, token)
            && !self.is_uncovered(position)
            && self.touches_own_area(position, player_id) {
            // game started, not yet game over, and tile not yet uncovered
            // so the player can and is allowed to uncover the tile
            self.uncover(position, player_id);
            if let Some(player) = self.players.get_mut(&player_id) {
                if is_mine(self.epoch, position, MINE_PROBABILITY) {
                    // game over
                    player.game_over = true;
                } else {
                    // increment score of player who uncovered the tile
                    player.score += 1;
                }
            }
        }
        GameStateResponse::Uncovered {
            tiles: self.visible_tiles(visible_area),
            players: self.players_response(),
        }
    }

    pub fn process_action(&mut self, action: PlayerAction) -> GameStateResponse {
        match action {
            PlayerAction::Join { visible_area } => self.handle_join_action(visible_area),
            PlayerAction::Update { area_to_update } => self.handle_update_action(area_to_update),
            PlayerAction::Uncover { player_id, token, position, visible_area } => {
                self.handle_uncover_action(player_id, token, position, visible_area)
            }
        }
    }

    pub fn player_valid_and_playing(&self, player_id: u32, token: String) -> bool {
        if let Some(player) = self.players.get(&player_id) {
            player.token == token && !player.game_over
        } else {
            false
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

    pub fn visible_tiles(&self, area: Area) -> Vec<ClientTile> {
        self.board.iter().filter_map(|(&(x, y), db_tile)| {
            if x >= area.0.0 && x <= area.1.0 && y >= area.0.1 && y <= area.1.1 {
                Some(ClientTile {
                    position: (x, y),
                    player_id: db_tile.player_id,
                    adjacent_mines: self.adjacent_mines((x, y)),
                    is_mine: self.is_mine((x, y)),
                })
            } else {
                None
            }
        }).collect()
    }

    pub fn uncover(&mut self, position: Position, player_id: u32) {
        if self.is_uncovered(position) { return; }
        let current_time = seconds_since(self.epoch);
        self.board.insert(position, DbTile {
            player_id,
            uncovered: current_time,
        });
        println!("There were {} recent tiles, pushing ({}, {})", self.uncover_history.len(), position.0, position.1);
        self.uncover_history.push_back(position);
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
    pub fn find_random_start_position(&self) -> Position {
        // Pick a random recently uncovered tile
        let mut rng = rand::thread_rng();
        println!("There are {} recent tiles", self.uncover_history.len());
        let origin = if self.uncover_history.is_empty() {
            (0, 0)
        } else {
            let random_index = rng.gen_range(0..self.uncover_history.len());
            self.uncover_history.iter().nth(random_index).unwrap().clone()
        };
        println!("Picked tile ({}, {})", origin.0, origin.1);
        // Pick a random angle and use a line drawing algorithm to walk in that direction until a
        // suitable tile is found.
        let angle = rng.gen_range(0.0..std::f64::consts::PI * 2.0);
        println!("Picked angle {}", angle);
        let mut steps = 0;
        for position in bresenham_line_towards_angle(angle, origin) {
            println!("Checking tile ({}, {})", position.0, position.1);
            if self.is_uncovered(position) {
                steps = 0;
            } else {
                steps += 1;
                if steps > 5 && !self.is_mine(position) && self.adjacent_mines(position) == 0 {
                    return position;
                }
            }
        }
        (0, 0)
    }

    pub fn is_uncovered(&self, position: Position) -> bool {
        self.board.contains_key(&position)
    }

    pub fn is_mine(&self, position: Position) -> bool {
        is_mine(self.epoch, position, MINE_PROBABILITY)
    }

    pub fn touches_own_area(&self, position: Position, player_id: u32) -> bool {
        for adjacent_position in tiles_around(position) {
            if let Some(tile) = self.board.get(&adjacent_position) {
                if tile.player_id == player_id {
                    return true;
                }
            }
        }
        false
    }

    pub fn adjacent_mines(&self, position: Position) -> i8 {
        tiles_around(position).filter(|&pos| self.is_mine(pos)).count() as i8
    }
}

// iterate over all tiles around a position, but not the tile itself
fn tiles_around(position: Position) -> impl Iterator<Item=Position> {
    (-1..=1).flat_map(move |dx|
    (-1..=1).map(move |dy| (position.0 + dx, position.1 + dy))
    ).filter(move |&pos| pos != position)
}

fn bresenham_line_towards_angle(angle: f64, origin: Position) -> impl Iterator<Item=Position> {
    let dx = (angle.cos() * 10000.0).round() as i32;
    let dy = (angle.sin() * 10000.0).round() as i32;
    let mut x = origin.0;
    let mut y = origin.1;
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


fn is_mine(seed: u32, position: Position, probability: f64) -> bool {
    // Step 1: Combine `x`, `y`, and `s` into a single hash value
    let mut hasher = DefaultHasher::new();
    (seed, position).hash(&mut hasher);
    let hash_value = hasher.finish();

    // Step 2: Convert the hash value to a pseudo-random number in [0, 1)
    // Here, we use the maximum value of u64 as a normalization factor
    let random_value = (hash_value as f64) / (u64::MAX as f64);

    // Step 3: Compare the pseudo-random number with `p`
    random_value < probability
}