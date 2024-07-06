use std::convert::Infallible;
use std::sync::Arc;

use futures_util::{SinkExt, StreamExt};
use tokio::sync::Mutex;
use warp::{Filter, fs::dir, reply::with::header};
use warp::ws::Message;

use game_state::{GameState, PlayerAction};

use crate::tls::show_hostnames;

mod game_state;
mod tls;

const PORT: u16 = 3030;

#[tokio::main]
async fn main() {
    let game_state = Arc::new(Mutex::new(GameState::new()));

    // Static files serving
    let static_files = dir("public");

    // WebSocket upgrade logic
    let websocket_route = warp::path("ws")
        .and(warp::ws())
        .and(warp::any().map(move || game_state.clone()))
        .and_then(upgrade_ws);

    // Combine static files serving and WebSocket handling
    let routes = static_files.or(websocket_route)
        .with(header("Cache-Control", "no-store"))
        .with(header("Pragma", "no-cache"))
        .with(header("Expires", "Sat, 01 Jan 2000 00:00:00 GMT"));

    show_hostnames(PORT);

    // Serve with SSL
    warp::serve(routes)
        .tls()
        .cert_path("cert.pem")
        .key_path("key.pem")
        .run(([0, 0, 0, 0], PORT))
        .await;
}

async fn upgrade_ws(ws: warp::ws::Ws, game_state: Arc<Mutex<GameState>>) -> Result<impl warp::Reply, Infallible> {
    Ok(ws.on_upgrade(move |socket| handle_connection(socket, game_state)))
}

async fn handle_connection(ws: warp::ws::WebSocket, game_state: Arc<Mutex<GameState>>) {
    let (mut writer, mut reader) = ws.split();
    while let Some(Ok(message)) = reader.next().await {
        if message.is_text() {
            if let Ok(text) = message.to_str() {
                let action: PlayerAction = serde_json::from_str(text).unwrap();
                let response = game_state.lock().await.process_action(action);
                let response_text = serde_json::to_string(&response).unwrap();
                writer.send(Message::text(response_text)).await.unwrap();
            }
        }
    }
}