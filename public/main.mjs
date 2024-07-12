import { updateLeaderboard } from './leaderboard.mjs';
import { gameState, getVisibleArea } from './game_state.mjs';
import { TILE_SIZE } from "./ui/defaults.mjs";
import { renderTile } from './ui/tileRenderer.mjs';
import { initializeCanvas } from './ui/canvas.mjs';
import { createCoveredTilePattern } from './ui/coveredTilePattern.mjs';
import { initializeEventListeners } from './ui/eventHandlers.mjs';

const { canvas, ctx } = initializeCanvas();

function log(...args) {
    console.log(new Date().toISOString().substring(11, 23), ...args);
}

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

initializeEventListeners(canvas, ws, renderGame);

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
        renderTile(ctx, position, tile, left, top, gameState, TILE_SIZE);
    });
}

const coveredTilePattern = createCoveredTilePattern(ctx);



// FOR DEBUGGING:
window.getVisibleArea = getVisibleArea;
window.gameState = gameState;
