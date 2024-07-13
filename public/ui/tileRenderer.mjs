import { TILE_SIZE } from './defaults.mjs';

export function renderTile(ctx, position, tile, left, top, gameState, tileSize = TILE_SIZE) {
    const player = gameState.players[tile.player_id];
    // Sometimes the player is not found, this is for alerting the tester about it:
    if (!player) console.log('*** Player not found:', tile.player_id);
    ctx.fillStyle = '#808080';
    ctx.fillRect(left, top, tileSize, tileSize);
    ctx.fillStyle = tile.is_mine ? 'red' : player ? player.color : 'black';
    ctx.fillRect(left + 1, top + 1, tileSize - 2, tileSize - 2);
    if (!tile.is_mine && tile.adjacent_mines > 0) {
        const colors = ['#0100fe', '#008001', '#fe0000', '#00007f', '#800000', '#008081', '#000000', '#808080'];
        ctx.fillStyle = colors[tile.adjacent_mines - 1];
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tile.adjacent_mines.toString(), left + tileSize / 2, top + tileSize / 2);
    }
}
