import { updateLeaderboard, updatePlayerName } from './leaderboard.mjs';
import { gameState } from './game_state.mjs';
import { renderGame, handleJoinResponse, updatePlayers } from './ui/gameRenderer.mjs';

let ws;
const messageHandlers = {};

function log(...args) {
    console.log(new Date().toISOString().substring(11, 23), ...args);
}

export function initializeWebSocket() {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws`);

    ws.addEventListener('open', () => {
        const horizontalTiles = Math.floor(canvas.width / TILE_SIZE);
        const verticalTiles = Math.floor(canvas.height / TILE_SIZE);

        safeSend(JSON.stringify({
            action_type: 'Join',
            visible_area: [
                [Math.floor(-horizontalTiles / 2), Math.ceil(-verticalTiles / 2)],  // left, top
                [Math.floor(horizontalTiles / 2), Math.ceil(verticalTiles / 2)]  // right, bottom
            ]
        }));
    });

    ws.addEventListener('close', (event) => {
        log('WebSocket closed:', event);
    });

    ws.addEventListener('error', (error) => {
        console.error('WebSocket error:', error);
    });

    ws.onmessage = (event) => {
        const parsedResponse = JSON.parse(event.data);
        const responseType = Object.keys(parsedResponse)[0];
        const response = parsedResponse[responseType];
        log('Message received from server', event.data.length, 'bytes', response);
        Object.entries(response.tiles).forEach(([positionString, tile]) => {
            gameState.tiles[positionString] = tile;
        });

        if (messageHandlers[responseType]) {
            messageHandlers[responseType](response);
        } else {
            console.error('Unknown response type:', responseType);
        }
    };

    gameState.ws = ws;
}

export function registerMessageHandler(responseType, handler) {
    messageHandlers[responseType] = handler;
}

export function safeSend(message) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
        console.log('Message sent to server', message);
    } else {
        console.error('WebSocket is not open. ReadyState:', ws.readyState);
    }
}

// Register default message handlers
registerMessageHandler('Joined', (response) => {
    handleJoinResponse(response);
    updatePlayers(response);
    updateLeaderboard();
    renderGame(true);
});

registerMessageHandler('Updated', (response) => {
    updatePlayers(response);
    updateLeaderboard();
    renderGame(true);
});

registerMessageHandler('Uncovered', (response) => {
    updatePlayers(response);
    updateLeaderboard();
    renderGame(false);
});

registerMessageHandler('Error', (response) => {
    console.error('Error:', response.message);
});

registerMessageHandler('NicknameUpdated', (response) => {
    updatePlayerName(response.player_id, response.new_name);
});
