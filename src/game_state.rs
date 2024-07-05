use serde::{Serialize, Deserialize};
use rand::Rng;
use std::collections::HashMap;

#[derive(Serialize, Deserialize, Clone)]
pub struct Tile {
    pub x: i64,
    pub y: i64,
    pub is_mine: bool,
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
}

#[derive(Serialize, Deserialize)]
pub struct GameStateResponse {
    pub tiles: Vec<Tile>,
    pub players: Vec<Player>,
}

pub struct GameState {
    pub board: HashMap<(i64, i64), Tile>,
    pub players: HashMap<u32, Player>,
    pub next_player_id: u32,
}

impl GameState {
    pub fn new(width: i64, height: i64) -> Self {
        let mut board = HashMap::new();
        let mut rng = rand::thread_rng();

        for x in 0..width {
            for y in 0..height {
                let is_mine = rng.gen_bool(0.15);
                board.insert((x, y), Tile {
                    x,
                    y,
                    is_mine,
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
            board,
            players: HashMap::new(),
            next_player_id: 1,
        }
    }

    pub fn process_action(&mut self, action: PlayerAction) -> GameStateResponse {
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
            }
            "uncover" => {
                if let Some(tile) = self.board.get_mut(&(action.x, action.y)) {
                    if !tile.is_mine {
                        if let Some(player) = self.players.get_mut(&action.player_id) {
                            player.score += 1;
                        }
                    }
                }
            }
            _ => {}
        }

        GameStateResponse {
            tiles: self.board.values().cloned().collect(),
            players: self.players.values().cloned().collect(),
        }
    }
}