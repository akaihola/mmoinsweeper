import { TILE_SIZE } from './defaults.mjs';
import { gameState, getVisibleArea } from '../game_state.mjs';

let mouseX = 0;
let mouseY = 0;
let isDragging = false;
let lastPosX = 0;
let lastPosY = 0;

export function initializeEventListeners(canvas, ws, renderGame) {
    canvas.addEventListener('mousedown', (event) => {
        isDragging = true;
        lastPosX = event.clientX;
        lastPosY = event.clientY;
    });

    canvas.addEventListener('mousemove', (event) => handleMove(event, ws, renderGame));

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
        handleMove(event.touches[0], ws, renderGame);
    }, {passive: true});

    canvas.addEventListener('touchend', () => {
        isDragging = false;
    });

    canvas.addEventListener('click', (event) => handleClick(event, ws));
    document.addEventListener('keyup', (event) => handleClick(event, ws));
}

function handleMove(event, ws, renderGame) {
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

function handleClick(event, ws) {
    console.log('Click event registered, mouse position:', mouseX, mouseY, 'event:', event.type);
    safeSend(ws, JSON.stringify({
        action_type: 'Uncover',
        player_id: gameState.player_id,
        token: gameState.token,
        position: getTileUnderMouse(),
        visible_area: getVisibleArea()
    }));
}

function getTileUnderMouse() {
    return [
        Math.floor((gameState.view_left + mouseX) / TILE_SIZE),
        Math.floor((gameState.view_top + mouseY) / TILE_SIZE)
    ];
}

function safeSend(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
        console.log('Message sent to server', message);
    } else {
        console.error('WebSocket is not open. ReadyState:', ws.readyState);
    }
}
