use std::sync::{Arc, Mutex};

use futures_util::{SinkExt, StreamExt};
use tokio::net::TcpListener;
use tokio_tungstenite::accept_async;

use game_state::{GameState, PlayerAction};

mod game_state;

fn format_now() -> String {
    chrono::Utc::now().format("%H:%M:%S%.3f").to_string()
}


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
                println!("Message received at: {:?}", format_now());
                if msg.is_text() {
                    let action: PlayerAction = serde_json::from_str(msg.to_text().unwrap()).unwrap();
                    let response = game_state.lock().unwrap().process_action(action);
                    let response_text = serde_json::to_string(&response).unwrap();
                    println!("Sending response at: {:?}", format_now());
                    write.send(tokio_tungstenite::tungstenite::Message::Text(response_text)).await.unwrap();
                }
            }
        });
    }
}