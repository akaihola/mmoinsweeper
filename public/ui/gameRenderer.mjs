import { TILE_SIZE } from './defaults.mjs';
import { gameState, getVisibleArea } from '../game_state.mjs';
import { renderTile } from './tileRenderer.mjs';
import { createCoveredTilePattern } from './coveredTilePattern.mjs';

let ctx;
let coveredTilePattern;

export function initializeRenderer(context) {
    ctx = context;
    coveredTilePattern = createCoveredTilePattern(ctx);
}

export function renderGame(clear) {
    if (clear) {
        const matrix = new DOMMatrix().translate(-gameState.view_left, -gameState.view_top)
        coveredTilePattern.setTransform(matrix);
        ctx.fillStyle = coveredTilePattern;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
    Object.entries(gameState.tiles).forEach(([position, tile]) => {
        const [x, y] = JSON.parse(`[${position}]`);
        const left = x * TILE_SIZE - gameState.view_left;
        if (left + TILE_SIZE < 0 || left > ctx.canvas.width) return;
        const top = y * TILE_SIZE - gameState.view_top;
        if (top + TILE_SIZE < 0 || top > ctx.canvas.height) return;
        renderTile(ctx, position, tile, left, top, gameState, TILE_SIZE);
    });
}

export function handleJoinResponse(response) {
    gameState.playing = true;
    gameState.player_id = response.player_id;
    gameState.token = response.token;
    gameState.view_left = TILE_SIZE * response.update_area[0][0];
    gameState.view_top = TILE_SIZE * response.update_area[0][1];
    gameState.view_right = TILE_SIZE * response.update_area[1][0];
    gameState.view_bottom = TILE_SIZE * response.update_area[1][1];
}

export function updatePlayers(response) {
    Object.entries(response.players).forEach(([playerId, player]) => {
        gameState.players[playerId] = {
            join_time: new Date(1000 * player.join_time),
            color: player.color,
            score: player.score
        };
    });
}
