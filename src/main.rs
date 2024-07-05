use tokio::net::TcpListener;
use tokio_tungstenite::accept_async;
use futures_util::StreamExt;
use std::sync::{Arc, Mutex};
use serde::{Serialize, Deserialize};

mod game_state;
use game_state::{GameState, PlayerAction};

#[tokio::main]
async fn main() {
    let addr = "127.0.0.1:8080";
    let listener = TcpListener::bind(&addr).await.expect("Failed to bind");

    let game_state = Arc::new(Mutex::new(GameState::new(1000, 1000)));

    while let Ok((stream, _)) = listener.accept().await {
        let game_state = game_state.clone();
        tokio::spawn(async move {
            let ws_stream = accept_async(stream).await.expect("Failed to accept");
            let (mut write, mut read) = ws_stream.split();

            while let Some(Ok(msg)) = read.next().await {
                if msg.is_text() {
                    let action: PlayerAction = serde_json::from_str(msg.to_text().unwrap()).unwrap();
                    let response = game_state.lock().unwrap().process_action(action);
                    let response_text = serde_json::to_string(&response).unwrap();
                    write.send(tokio_tungstenite::tungstenite::Message::Text(response_text)).await.unwrap();
                }
            }
        });
    }
}