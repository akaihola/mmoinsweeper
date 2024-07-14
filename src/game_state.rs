use std::collections::{HashMap, VecDeque};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

use chrono::Utc;
use rand::Rng;
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;
use warp::ws::Message;

pub type TileCoordinate = i64;
pub type Position = (TileCoordinate, TileCoordinate);
pub type PositionString = String;
pub type Area = (Position, Position);
pub type ServerTime = u32;
pub type UnixSeconds = u32;

fn seconds_since(epoch: u32) -> ServerTime {
    Utc::now().timestamp() as u32 - epoch
}

const MINE_PROBABILITY: f64 = 0.2;

pub struct DbTile {
    pub uncovered: ServerTime,  // seconds since beginning of game, zero = not uncovered
    pub player_id: u32,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ClientTile {
    pub player_id: u32,
    pub adjacent_mines: i8,
    pub is_mine: bool,
}

#[derive(Clone)]
pub struct DbPlayer {
    pub token: String,
    pub join_time: ServerTime,
    pub game_over: bool,
    pub color: String,
    pub score: u32,
    pub sender: Option<mpsc::UnboundedSender<Message>>,
    pub visible_area: Area,
    pub name: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ClientPlayer {
    pub join_time: UnixSeconds,
    pub color: String,
    pub score: u32,
    pub name: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(tag = "action_type")]
pub enum PlayerAction {
    Join {
        visible_area: Area,
        token: Option<String>,
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
    UpdateNickname {
        player_id: u32,
        token: String,
        new_name: String,
    },
}

#[derive(Serialize, Deserialize)]
pub enum GameStateResponse {
    Joined {
        player_id: u32,
        token: String,
        update_area: Area,
        tiles: HashMap<PositionString, ClientTile>,
        players: HashMap<u32, ClientPlayer>,
    },
    Updated {
        tiles: HashMap<PositionString, ClientTile>,
        players: HashMap<u32, ClientPlayer>,
    },
    Uncovered {
        tiles: HashMap<PositionString, ClientTile>,
        players: HashMap<u32, ClientPlayer>,
    },
    NicknameUpdated {
        player_id: u32,
        new_name: String,
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

    pub fn handle_update_nickname_action(&mut self, player_id: u32, token: String, new_name: String) -> GameStateResponse {
        if self.player_valid_and_playing(player_id, token) {
            if let Some(player) = self.players.get_mut(&player_id) {
                player.name = new_name.clone();
                GameStateResponse::NicknameUpdated {
                    player_id,
                    new_name,
                    players: self.players_response(None),
                }
            } else {
                GameStateResponse::Error {
                    message: "Player not found".to_string(),
                }
            }
        } else {
            GameStateResponse::Error {
                message: "Invalid player or token".to_string(),
            }
        }
    }

    pub fn set_player_sender(&mut self, player_id: u32, sender: mpsc::UnboundedSender<Message>) {
        if let Some(player) = self.players.get_mut(&player_id) {
            player.sender = Some(sender);
        }
    }

    pub fn remove_player(&mut self, player_id: u32) {
        if let Some(player) = self.players.get_mut(&player_id) {
            player.sender = None;
        }
    }

    pub fn broadcast_tile(&self, position: Position) {
        // Broadcast the changed tile to all players who should see it
        let tile = self.board.get(&position).unwrap();
        let response = GameStateResponse::Uncovered {
            tiles: self.visible_tiles((position, position)),
            players: self.players_response(Some(&[tile.player_id])),
        };
        let message = serde_json::to_string(&response).unwrap();
        for (_, player) in &self.players {
            if areas_intersect((position, position), player.visible_area) {
                if let Some(sender) = &player.sender {
                    let _ = sender.send(Message::text(message.to_string()));
                }
            }
        }
    }

    pub fn handle_join_action(&mut self, visible_area: Area, token: Option<String>) -> GameStateResponse {
        let player_id = self.next_player_id;  // non-zero = playing
        self.next_player_id += 1;
        let start_position = self.find_random_start_position();
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

        let (token, name) = if let Some(token) = token {
            if let Some(existing_player) = self.players.values().find(|p| p.token == token) {
                (token, existing_player.name.clone())
            } else {
                (uuid::Uuid::new_v4().to_string(), format!("Player {}", player_id))
            }
        } else {
            (uuid::Uuid::new_v4().to_string(), format!("Player {}", player_id))
        };

        self.players.insert(player_id, DbPlayer {
            join_time: seconds_since(self.epoch),
            token: token.clone(),
            color: format!("#{:06x}", rand::thread_rng().gen_range(0..0xFFFFFF)),
            score: 0,
            game_over: false,
            sender: None,
            visible_area,
            name,
        });

        self.uncover(start_position, player_id);
        // Broadcast the opening tile to all players who should see it
        self.broadcast_tile(start_position);

        GameStateResponse::Joined {
            player_id: player_id,
            token: token,
            update_area: visible_area,
            tiles: self.visible_tiles(visible_area),
            players: self.players_response(None),
        }
    }

    pub fn handle_update_action(&self, area_to_update: Area) -> GameStateResponse {
        let tiles = self.visible_tiles(area_to_update);
        let player_ids = tiles.values().map(|tile| tile.player_id).collect::<Vec<_>>();
        let players = self.players_response(Some(player_ids.as_slice()));
        GameStateResponse::Updated { tiles, players }
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
            // Broadcast the changed tile to all players who should see it
            self.broadcast_tile(position);
        }
        GameStateResponse::Uncovered {
            tiles: self.visible_tiles(visible_area),
            players: self.players_response(Some(&[player_id])),
        }
    }

    pub fn process_action(&mut self, action: PlayerAction) -> GameStateResponse {
        match action {
            PlayerAction::Join { visible_area, token } => self.handle_join_action(visible_area, token),
            PlayerAction::Update { area_to_update } => self.handle_update_action(area_to_update),
            PlayerAction::Uncover { player_id, token, position, visible_area } => {
                self.handle_uncover_action(player_id, token, position, visible_area)
            },
            PlayerAction::UpdateNickname { player_id, token, new_name } => {
                self.handle_update_nickname_action(player_id, token, new_name)
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

    pub fn players_response(&self, player_ids: Option<&[u32]>) -> HashMap<u32, ClientPlayer> {
        self.players.iter().filter_map(|(&id, player)| {
            if player_ids.map_or(true, |ids| ids.contains(&id)) {
                Some((id, ClientPlayer {
                    join_time: self.epoch + player.join_time,
                    color: player.color.clone(),
                    score: player.score,
                    name: player.name.clone(),
                }))
            } else {
                None
            }
        }).collect()
    }

    pub fn visible_tiles(&self, area: Area) -> HashMap<PositionString, ClientTile> {
        self.board.iter().filter_map(|(&(x, y), db_tile)| {
            if x >= area.0.0 && x <= area.1.0 && y >= area.0.1 && y <= area.1.1 {
                let position_string = format!("{},{}", x, y);
                let tile = ClientTile {
                    player_id: db_tile.player_id,
                    adjacent_mines: self.adjacent_mines((x, y)),
                    is_mine: self.is_mine((x, y)),
                };
                Some((position_string, tile))
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
        self.uncover_history.push_back(position);
        // Remove items older than 10 minutes (600 seconds) unless the list is shorter than 100 items
        while let Some(x_y) = self.uncover_history.front() {
            let timestamp = self.board.get(x_y).unwrap().uncovered;
            if current_time - timestamp > 600 && self.uncover_history.len() > 100 {
                self.uncover_history.pop_front();
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
        let origin = if self.uncover_history.is_empty() {
            (0, 0)
        } else {
            let random_index = rng.gen_range(0..self.uncover_history.len());
            self.uncover_history.iter().nth(random_index).unwrap().clone()
        };
        // Pick a random angle and use a line drawing algorithm to walk in that direction until a
        // suitable tile is found.
        let angle = rng.gen_range(0.0..std::f64::consts::PI * 2.0);
        let mut steps = 0;
        for position in bresenham_line_towards_angle(angle, origin) {
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


// Helper function to check if two areas intersect
fn areas_intersect(area1: Area, area2: Area) -> bool {
    let (left1, top1) = area1.0;
    let (right1, bottom1) = area1.1;
    let (left2, top2) = area2.0;
    let (right2, bottom2) = area2.1;

    left1 <= right2 && right1 >= left2 && top1 <= bottom2 && bottom1 >= top2
}
