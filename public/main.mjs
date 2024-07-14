import {TILE_SIZE} from './ui/defaults.mjs';
import {gameState} from './game_state.mjs';
import {getVisibleArea} from './ui/viewportUtils.mjs';
import {initializeCanvas} from './ui/canvas.mjs';
import {initializeUiEventListeners} from './ui/uiEventHandlers.mjs';
import {initializeRenderer} from './ui/gameRenderer.mjs';
import {initializeWebSocket} from './net/websocket.mjs';
import {getJoinAction, registerResponseHandlers} from "./net/serverProtocol.mjs";

const {canvas, ctx} = initializeCanvas();
initializeRenderer(ctx);
const horizontalTiles = Math.floor(canvas.width / TILE_SIZE);
const verticalTiles = Math.floor(canvas.height / TILE_SIZE);

const joinAction = getJoinAction(horizontalTiles, verticalTiles, gameState.token);
initializeWebSocket(joinAction);
registerResponseHandlers();
initializeUiEventListeners(canvas);

// FOR DEBUGGING:
window.getVisibleArea = getVisibleArea;
window.gameState = gameState;
