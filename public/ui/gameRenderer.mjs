import {TILE_SIZE} from './defaults.mjs';
import {gameState} from '../game_state.mjs';
import {uiState} from './uiState.mjs';
import {renderTile} from './tileRenderer.mjs';
import {createCoveredTilePattern} from './coveredTilePattern.mjs';

let ctx;
let coveredTilePattern;

export function initializeRenderer(context) {
    ctx = context;
    coveredTilePattern = createCoveredTilePattern(ctx);
}

export function renderGame(clear) {
    if (clear) {
        const matrix = new DOMMatrix().translate(-uiState.view_left, -uiState.view_top)
        coveredTilePattern.setTransform(matrix);
        ctx.fillStyle = coveredTilePattern;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
    Object.entries(gameState.tiles).forEach(([position, tile]) => {
        const [x, y] = JSON.parse(`[${position}]`);
        const left = x * TILE_SIZE - uiState.view_left;
        if (left + TILE_SIZE < 0 || left > ctx.canvas.width) return;
        const top = y * TILE_SIZE - uiState.view_top;
        if (top + TILE_SIZE < 0 || top > ctx.canvas.height) return;
        renderTile(ctx, position, tile, left, top, gameState, TILE_SIZE);
    });
}

