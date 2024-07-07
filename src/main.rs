use std::convert::Infallible;
use std::sync::Arc;

use futures_util::{SinkExt, StreamExt};
use tokio::sync::Mutex;
use warp::Filter;
use warp::http::header::{CACHE_CONTROL, EXPIRES, HeaderMap, HeaderValue, PRAGMA};
use warp::ws::Message;

use game_state::{GameState, PlayerAction};
use tls::show_hostnames;

mod game_state;
mod tls;

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

fn get_headers(no_cache: bool) -> HeaderMap {
    let mut headers = HeaderMap::new();
    if no_cache {
        headers.insert(CACHE_CONTROL, HeaderValue::from_static("no-store"));
        headers.insert(PRAGMA, HeaderValue::from_static("no-cache"));
        headers.insert(EXPIRES, HeaderValue::from_static("Sat, 01 Jan 2000 00:00:00 GMT"));
    }
    headers
}

async fn run_server(no_cache: bool, use_tls: bool, port: u16) {
    let static_files = warp::fs::dir("public");
    let game_state = Arc::new(Mutex::new(GameState::new()));

    // WebSocket upgrade logic
    let websocket_route = warp::path("ws")
        .and(warp::ws())
        .and(warp::any().map(move || game_state.clone()))
        .and_then(upgrade_ws);

    let routes = static_files.or(websocket_route);

    // Apply headers
    let headers = get_headers(no_cache);
    let routes = routes.with(warp::reply::with::headers(headers));

    let addr = ([0, 0, 0, 0], port);

    if use_tls {
        warp::serve(routes)
            .tls()
            .cert_path("cert.pem")
            .key_path("key.pem")
            .run(addr)
            .await;
    } else {
        warp::serve(routes).run(addr).await;
    }
}

#[tokio::main]
async fn main() {
    let no_cache = true; // TODO: Set based on command line args or config
    let use_tls = true;  // TODO: Set based on command line args or config
    let port = 3030;     // TODO: Set based on command line args or config
    show_hostnames(port);
    run_server(no_cache, use_tls, port).await;
}
