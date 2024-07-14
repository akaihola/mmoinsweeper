import { gameState } from './game_state.mjs';
import { getVisibleArea } from './ui/viewportUtils.mjs';
import { initializeCanvas } from './ui/canvas.mjs';
import { initializeEventListeners } from './ui/eventHandlers.mjs';
import { initializeRenderer } from './ui/gameRenderer.mjs';
import { initializeWebSocket } from './websocket.mjs';

const { canvas, ctx } = initializeCanvas();
initializeRenderer(ctx);
initializeWebSocket();
initializeEventListeners(canvas, renderGame);

// FOR DEBUGGING:
window.getVisibleArea = getVisibleArea;
window.gameState = gameState;
