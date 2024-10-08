import {gameState} from '../game_state.mjs';
import {log} from "../utils.mjs";
import {registerResponseHandlers} from "./serverProtocol.mjs";

let ws;
const messageHandlers = {};

export function initializeWebSocket(joinAction) {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws`);

    ws.addEventListener('open', () => {
        safeSend(JSON.stringify(joinAction));
    });

    ws.addEventListener('close', (event) => {
        log('WebSocket closed:', event);
    });

    ws.addEventListener('error', (error) => {
        console.error('WebSocket error:', error);
    });

    ws.onmessage = (event) => {
        log('Raw message received from server:', event.data);
        try {
            const parsedResponse = JSON.parse(event.data);
            const responseType = Object.keys(parsedResponse)[0];
            const response = parsedResponse[responseType];
            log('Parsed message:', response);
            
            if (response && response.tiles) {
                Object.entries(response.tiles).forEach(([positionString, tile]) => {
                    gameState.tiles[positionString] = tile;
                });
            }

            if (messageHandlers[responseType]) {
                messageHandlers[responseType](response);
            } else {
                console.error('Unknown response type:', responseType);
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    };

    gameState.ws = ws;
}

export function registerResponseHandler(responseType, handler) {
    messageHandlers[responseType] = handler;
}

export function safeSend(message) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
        log('Message sent to server', message);
    } else {
        console.error('WebSocket is not open. ReadyState:', ws.readyState);
    }
}

registerResponseHandlers();
