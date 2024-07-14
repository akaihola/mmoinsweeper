import { TILE_SIZE } from './ui/defaults.mjs';
import { gameState } from './game_state.mjs';
import { getVisibleArea } from './ui/viewportUtils.mjs';
import { initializeCanvas } from './ui/canvas.mjs';
import { initializeEventListeners } from './ui/eventHandlers.mjs';
import { initializeRenderer, renderGame } from './ui/gameRenderer.mjs';
import { initializeWebSocket } from './websocket.mjs';

const { canvas, ctx } = initializeCanvas();
initializeRenderer(ctx);
const horizontalTiles = Math.floor(canvas.width / TILE_SIZE);
const verticalTiles = Math.floor(canvas.height / TILE_SIZE);
const storedToken = localStorage.getItem('playerToken');
initializeWebSocket({
    action_type: 'Join',
    visible_area: [
        [Math.floor(-horizontalTiles / 2), Math.ceil(-verticalTiles / 2)],  // left, top
        [Math.floor(horizontalTiles / 2), Math.ceil(verticalTiles / 2)]  // right, bottom
    ],
    token: storedToken || null
});
initializeEventListeners(canvas);

// FOR DEBUGGING:
window.getVisibleArea = getVisibleArea;
window.gameState = gameState;
