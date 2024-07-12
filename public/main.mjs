import { updateLeaderboard } from './leaderboard.mjs';
import { gameState } from './game_state.mjs';
import { getVisibleArea } from './ui/viewportUtils.mjs';
import { TILE_SIZE } from "./ui/defaults.mjs";
import { initializeCanvas } from './ui/canvas.mjs';
import { initializeEventListeners } from './ui/eventHandlers.mjs';
import { initializeRenderer, renderGame, handleJoinResponse, updatePlayers } from './ui/gameRenderer.mjs';

const { canvas, ctx } = initializeCanvas();
initializeRenderer(ctx);

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
            updateLeaderboard();
            renderGame(true);
            break;
        case 'Updated':
            renderGame(true);
            break;
        case 'Uncovered':
            updatePlayers(response);
            updateLeaderboard();
            renderGame(false);
            break;
        case 'Error':
            console.error('Error:', response.message);
            break;
        default:
            console.error('Unknown response type:', responseType);
    }
}

// FOR DEBUGGING:
window.getVisibleArea = getVisibleArea;
window.gameState = gameState;
