import { TILE_SIZE } from './defaults.mjs';

export function createCoveredTilePattern(ctx) {
    const coveredTileCanvas = new OffscreenCanvas(TILE_SIZE, TILE_SIZE);
    const coveredTileCtx = coveredTileCanvas.getContext('2d');
    coveredTileCtx.fillStyle = '#ffffff';
    coveredTileCtx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    coveredTileCtx.fillStyle = '#808080';
    coveredTileCtx.fillRect(2, 2, TILE_SIZE - 2, TILE_SIZE - 2);
    coveredTileCtx.fillStyle = '#c0c0c0';
    coveredTileCtx.fillRect(2, 2, TILE_SIZE - 4, TILE_SIZE - 4);
    coveredTileCtx.strokeStyle = '#c0c0c0';
    coveredTileCtx.lineWidth = 2.0;
    coveredTileCtx.beginPath();
    coveredTileCtx.moveTo(TILE_SIZE + 0.5, -0.5);
    coveredTileCtx.lineTo(-0.5, TILE_SIZE + 0.5);
    coveredTileCtx.stroke();
    return ctx.createPattern(coveredTileCanvas, 'repeat');
}
