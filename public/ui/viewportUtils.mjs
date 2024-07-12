import { TILE_SIZE } from './defaults.mjs';
import { uiState } from './uiState.mjs';

export function getVisibleArea() {
    return [
        [Math.floor(uiState.view_left / TILE_SIZE), Math.floor(uiState.view_top / TILE_SIZE)],
        [Math.ceil(uiState.view_right / TILE_SIZE), Math.ceil(uiState.view_bottom / TILE_SIZE)]
    ];
}
