import { updateLeaderboard } from './leaderboard.mjs';
import { gameState, getVisibleArea } from './game_state.mjs';
import { TILE_SIZE} from "./defaults.mjs";


const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

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
        renderGame(true);
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

const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws`);

// Check WebSocket connection state before sending a message
function safeSend(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
        log('Message sent to server', message);
    } else {
        console.error('WebSocket is not open. ReadyState:', ws.readyState);
    }
}

ws.addEventListener('open', () => {
    const horizontalTiles = Math.floor(canvas.width / TILE_SIZE);
    const verticalTiles = Math.floor(canvas.height / TILE_SIZE);

    safeSend(ws, JSON.stringify({
        action_type: 'Join',
        visible_area: [
            [Math.floor(-horizontalTiles / 2), Math.ceil(-verticalTiles / 2)],  // left, top
            [Math.floor(horizontalTiles / 2), Math.ceil(verticalTiles / 2)]  // right, bottom
        ]
    }));
});

// Handle WebSocket closure and errors
ws.addEventListener('close', (event) => {
    log('WebSocket closed:', event);
});

ws.addEventListener('error', (error) => {
    console.error('WebSocket error:', error);
});

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
    const parsedResponse = JSON.parse(event.data);
    const responseType = Object.keys(parsedResponse)[0];
    const response = parsedResponse[responseType];
    log('Message received from server', event.data.length, 'bytes', response);
    Object.entries(response.tiles).forEach(([positionString, tile]) => {
        console.log(positionString, tile);
        gameState.tiles[positionString] = tile;
    });
    switch (responseType) {
        case 'Joined':
            handleJoinResponse(response);
            updatePlayers(response);
            renderGame(true);
            break;
        case 'Updated':
            renderGame(true);
            break;
        case 'Uncovered':
            updatePlayers(response);
            renderGame(false);
            break;
        case 'Error':
            console.error('Error:', response.message);
            break;
        default:
            console.error('Unknown response type:', responseType);
    }
}

function updatePlayers(response) {
    Object.entries(response.players).forEach(([playerId, player]) => {
        gameState.players[playerId] = {
            join_time: new Date(1000 * player.join_time),
            color: player.color,
            score: player.score
        };
    });
    updateLeaderboard();
}

function handleJoinResponse(response) {
    gameState.playing = true;
    gameState.player_id = response.player_id;
    gameState.token = response.token;
    gameState.view_left = TILE_SIZE * response.update_area[0][0];
    gameState.view_top = TILE_SIZE * response.update_area[0][1];
    gameState.view_right = TILE_SIZE * response.update_area[1][0];
    gameState.view_bottom = TILE_SIZE * response.update_area[1][1];
}

function renderTile(position, tile, left, top) {
    const player = gameState.players[tile.player_id];
    // Sometimes the player is not found, this is for alerting the tester about it:
    if (!player) alert('Player not found:', tile.player_id);
    ctx.fillStyle = '#808080';
    ctx.fillRect(left, top, TILE_SIZE, TILE_SIZE);
    ctx.fillStyle = tile.is_mine ? 'red' : player ? player.color : 'black';
    ctx.fillRect(left + 1, top + 1, TILE_SIZE - 2, TILE_SIZE - 2);
    if (!tile.is_mine && tile.adjacent_mines > 0) {
        const colors = ['#0100fe', '#008001', '#fe0000', '#00007f', '#800000', '#008081', '#000000', '#808080'];
        ctx.fillStyle = colors[tile.adjacent_mines - 1] || '#000000';
        ctx.textAlign = 'center';
        ctx.font = `bold ${3 * TILE_SIZE / 4}px Impact`;
        ctx.fillText(tile.adjacent_mines, left + TILE_SIZE / 2, top + 3 * TILE_SIZE / 4);
    }
}

function renderGame(clear) {
    if (clear) {
        const matrix = new DOMMatrix().translate(-gameState.view_left, -gameState.view_top)
        coveredTilePattern.setTransform(matrix);
        ctx.fillStyle = coveredTilePattern;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    Object.entries(gameState.tiles).forEach(([position, tile]) => {
        const [x, y] = JSON.parse(`[${position}]`);
        const left = x * TILE_SIZE - gameState.view_left;
        if (left + TILE_SIZE < 0 || left > canvas.width) return;
        const top = y * TILE_SIZE - gameState.view_top;
        if (top + TILE_SIZE < 0 || top > canvas.height) return;
        renderTile(position, tile, left, top);
    });
}

const coveredTileCanvas = new OffscreenCanvas(TILE_SIZE, TILE_SIZE);
const coveredTileCtx = coveredTileCanvas.getContext('2d');
coveredTileCtx.fillStyle = '#ffffff';
coveredTileCtx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
coveredTileCtx.fillStyle = '#808080';
coveredTileCtx.fillRect(2, 2, TILE_SIZE - 2, TILE_SIZE - 2);
coveredTileCtx.fillStyle = '#c0c0c0';
coveredTileCtx.fillRect(2, 2, TILE_SIZE - 4, TILE_SIZE - 4);
coveredTileCtx.strokeStyle = '#c0c0c0';
coveredTileCtx.lineWidth = 2.0;
coveredTileCtx.beginPath();
coveredTileCtx.moveTo(TILE_SIZE + 0.5, -0.5);
coveredTileCtx.lineTo(-0.5, TILE_SIZE + 0.5);
coveredTileCtx.stroke();
const coveredTilePattern = ctx.createPattern(coveredTileCanvas, 'repeat');



// FOR DEBUGGING:
window.getVisibleArea = getVisibleArea;
window.gameState = gameState;
