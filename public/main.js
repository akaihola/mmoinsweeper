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

let mouseX = 0;
let mouseY = 0;
let isDragging = false;
let lastPosX = 0;
let lastPosY = 0;

canvas.addEventListener('mousedown', (event) => {
    isDragging = true;
    lastPosX = event.clientX;
    lastPosY = event.clientY;
});

function handleMove(event) {
    if (isDragging) {
        const deltaX = event.clientX - lastPosX;
        const deltaY = event.clientY - lastPosY;
        gameState.view_left -= deltaX;
        gameState.view_right -= deltaX;
        gameState.view_top -= deltaY;
        gameState.view_bottom -= deltaY;
        lastPosX = event.clientX;
        lastPosY = event.clientY;
        safeSend(ws, JSON.stringify({
            action_type: 'Update',
            area_to_update: getVisibleArea()
        }));
        renderGame();
    } else {
        mouseX = event.clientX;
        mouseY = event.clientY;
    }
}

canvas.addEventListener('mousemove', handleMove);

canvas.addEventListener('mouseup', () => {
    isDragging = false;
});

canvas.addEventListener('touchstart', (event) => {
    const touch = event.touches[0];
    isDragging = true;
    lastPosX = touch.clientX;
    lastPosY = touch.clientY;
}, {passive: true});

canvas.addEventListener('touchmove', (event) => {
    handleMove(event.touches[0]);
}, {passive: true});

canvas.addEventListener('touchend', () => {
    isDragging = false;
});

const ws = new WebSocket('ws://localhost:8080/ws');

// Check WebSocket connection state before sending a message
function safeSend(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
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
        action_type: 'Join',
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

function getVisibleArea() {
    return [
        Math.floor(gameState.view_left / TILE_SIZE),
        Math.floor(gameState.view_top / TILE_SIZE),
        Math.ceil(gameState.view_right / TILE_SIZE),
        Math.ceil(gameState.view_bottom / TILE_SIZE)
    ];
}

function getTileUnderMouse() {
    return [
        Math.floor((gameState.view_left + mouseX) / TILE_SIZE),
        Math.floor((gameState.view_top + mouseY) / TILE_SIZE)
    ]
}

function handle_click(event) {
    log('Click event registered, mouse position:', mouseX, mouseY, 'event:', event.type);
    safeSend(ws, JSON.stringify({
        action_type: 'Uncover',
        player_id: gameState.player_id,
        token: gameState.token,
        position: getTileUnderMouse(),
        visible_area: getVisibleArea()
    }));
}

canvas.addEventListener('click', handle_click);
document.addEventListener('keyup', handle_click);

ws.onmessage = (event) => {
    log('Message received from server', event.data.length, 'bytes', event.data);
    const parsedResponse = JSON.parse(event.data);
    const responseType = Object.keys(parsedResponse)[0];
    const response = parsedResponse[responseType];
    gameState.tiles = response.tiles;
    gameState.players = response.players;
    switch (responseType) {
        case 'Joined':
            handleJoinResponse(response);
            break;
        case 'Updated':
            break;
        case 'Uncovered':
            break;
        case 'Error':
            console.error('Error:', response.message);
            break;
        default:
            console.error('Unknown response type:', responseType);
    }
    renderGame();
}

function handleJoinResponse(response){
    gameState.playing = true;
    gameState.player_id = response.player_id;
    gameState.token = response.token;
    gameState.view_left = TILE_SIZE * response.update_area[0];
    gameState.view_top = TILE_SIZE * response.update_area[1];
    gameState.view_right = TILE_SIZE * response.update_area[2];
    gameState.view_bottom = TILE_SIZE * response.update_area[3];
}

function renderGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    gameState.tiles.forEach(tile => {
        const [x, y] = tile.position;
        const player = gameState.players[tile.player_id];
        if (!player) {
            console.error('Player not found:', tile.player_id, 'in players', gameState.players);
            return;
        }
        ctx.fillStyle = tile.is_mine ? 'red' : player.color;
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