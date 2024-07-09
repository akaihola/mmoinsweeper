import { TILE_SIZE} from "./defaults.mjs";

export let gameState = {
    playing: false,
    tiles: {},
    players: [],
    view_top: 0,
    view_bottom: 0,
    view_left: 0,
    view_right: 0
};

export function getVisibleArea() {
    return [
        [Math.floor(gameState.view_left / TILE_SIZE), Math.floor(gameState.view_top / TILE_SIZE)],
        [Math.ceil(gameState.view_right / TILE_SIZE), Math.ceil(gameState.view_bottom / TILE_SIZE)]
    ];
}
