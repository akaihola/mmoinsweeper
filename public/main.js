const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const TILE_SIZE = 20;

let gameState = {
    playing: false,
    tiles: [],
    players: [],
    view_top: 0,
    view_bottom: 0,
    view_left: 0,
    view_right: 0
};

function log(...args) {
    console.log(new Date().toISOString().substring(11, 23), ...args);
}

const ws = new WebSocket('ws://localhost:8080');

// Check WebSocket connection state before sending a message
function safeSend(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
        log('Sending message to server', message);
        ws.send(message);
        log('Message sent to server', message);
    } else {
        console.error('WebSocket is not open. ReadyState:', ws.readyState);
    }
}

ws.onopen = () => {
    const horizontalTiles = Math.floor(canvas.width / TILE_SIZE);
    const verticalTiles = Math.floor(canvas.height / TILE_SIZE);

    safeSend(ws, JSON.stringify({
        player_id: 0,
        action_type: 'join',
        position: [0, 0],
        visible_area: [
            Math.floor(-horizontalTiles / 2),  // left
            Math.ceil(-verticalTiles / 2),  // top
            Math.floor(horizontalTiles / 2),  // right
            Math.ceil(verticalTiles / 2)  // bottom
        ]
    }));
};

// Handle WebSocket closure and errors
ws.onclose = (event) => {
    log('WebSocket closed:', event);
};

ws.onerror = (error) => {
    console.error('WebSocket error:', error);
};

canvas.addEventListener('click', (event) => {
    log('Click event registered');
    const x = Math.floor((gameState.view_left + event.clientX) / TILE_SIZE);
    const y = Math.floor((gameState.view_top + event.clientY) / TILE_SIZE);
    safeSend(ws, JSON.stringify({
        player_id: 1,
        action_type: 'uncover',
        position: [x, y],
        visible_area: [
            Math.floor(gameState.view_left / TILE_SIZE),
            Math.floor(gameState.view_top / TILE_SIZE),
            Math.ceil(gameState.view_right / TILE_SIZE),
            Math.ceil(gameState.view_bottom / TILE_SIZE)
        ]
    }));
});

ws.onmessage = (event) => {
    log('Message received from server', event.data.length, 'bytes', event.data);
    const response = JSON.parse(event.data);
    if (!gameState.playing) {
        gameState.view_left = TILE_SIZE * response.update_area[0];
        gameState.view_top = TILE_SIZE * response.update_area[1];
        gameState.view_right = TILE_SIZE * response.update_area[2];
        gameState.view_bottom = TILE_SIZE * response.update_area[3];
    }
    gameState = {
        playing: true,
        tiles: response.tiles,
        players: response.players,
        view_top: gameState.view_top,
        view_bottom: gameState.view_bottom,
        view_left: gameState.view_left,
        view_right: gameState.view_right
    };
    renderGame();
};

function renderGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    gameState.tiles.forEach(tile => {
        const [x, y] = tile.position;
        ctx.fillStyle = tile.is_mine ? 'red' : gameState.players[tile.player_id].color;
        ctx.fillRect(
            x * TILE_SIZE - gameState.view_left,
            y * TILE_SIZE - gameState.view_top,
            TILE_SIZE,
            TILE_SIZE
        );
        if (!tile.is_mine && tile.adjacent_mines > 0) {
            ctx.fillStyle = 'black';
            ctx.fillText(
                tile.adjacent_mines,
                x * TILE_SIZE - gameState.view_left + TILE_SIZE / 4,
                y * TILE_SIZE - gameState.view_top + 3 * TILE_SIZE / 4
            );
        }
    });
    Object.entries(gameState.players).forEach(([playerId, player]) => {
        ctx.fillStyle = player.color;
        ctx.fillText(
            `Player ${playerId}: ${player.score}`,
            TILE_SIZE / 2,
            TILE_SIZE * playerId
        );
    });
}