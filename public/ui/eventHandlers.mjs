import { TILE_SIZE } from './defaults.mjs';
import { gameState } from '../game_state.mjs';
import { uiState } from './uiState.mjs';
import { getVisibleArea } from './viewportUtils.mjs';
import { renderGame } from './gameRenderer.mjs';

let mouseX = 0;
let mouseY = 0;
let isDragging = false;
let lastPosX = 0;
let lastPosY = 0;

export function initializeEventListeners(canvas, renderGame) {
    canvas.addEventListener('mousedown', (event) => {
        isDragging = true;
        lastPosX = event.clientX;
        lastPosY = event.clientY;
    });

    canvas.addEventListener('mousemove', (event) => handleMove(event, renderGame));

    canvas.addEventListener('mouseup', () => {
        isDragging = false;
    });

    canvas.addEventListener('touchstart', (event) => {
        event.preventDefault();
        const touch = event.touches[0];
        isDragging = true;
        lastPosX = touch.clientX;
        lastPosY = touch.clientY;
    }, { passive: false });

    canvas.addEventListener('touchmove', (event) => {
        event.preventDefault();
        handleMove(event.touches[0], ws, renderGame);
    }, { passive: false });

    canvas.addEventListener('touchend', (event) => {
        event.preventDefault();
        isDragging = false;
        handleClick(event.changedTouches[0], ws);
    }, { passive: false });

    canvas.addEventListener('click', (event) => handleClick(event, ws));
    document.addEventListener('keyup', (event) => handleClick(event, ws));
}

function handleMove(event, renderGame) {
    if (isDragging) {
        const deltaX = event.clientX - lastPosX;
        const deltaY = event.clientY - lastPosY;
        uiState.view_left -= deltaX;
        uiState.view_right -= deltaX;
        uiState.view_top -= deltaY;
        uiState.view_bottom -= deltaY;
        lastPosX = event.clientX;
        lastPosY = event.clientY;
        safeSend(JSON.stringify({
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
    const x = event.clientX || event.pageX || mouseX;
    const y = event.clientY || event.pageY || mouseY;
    console.log('Click event registered, position:', x, y, 'event:', event.type);
    safeSend(ws, JSON.stringify({
        action_type: 'Uncover',
        player_id: gameState.player_id,
        token: gameState.token,
        position: getTileUnderPointer(x, y),
        visible_area: getVisibleArea()
    }));
}

function getTileUnderPointer(x, y) {
    return [
        Math.floor((uiState.view_left + x) / TILE_SIZE),
        Math.floor((uiState.view_top + y) / TILE_SIZE)
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
