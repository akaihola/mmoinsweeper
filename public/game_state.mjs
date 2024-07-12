import { TILE_SIZE} from "./ui/defaults.mjs";

export let gameState = {
    playing: false,
    player_id: null,
    token: null,
    tiles: {},
    players: []
};

export function getVisibleArea() {
    return [
        [Math.floor(gameState.view_left / TILE_SIZE), Math.floor(gameState.view_top / TILE_SIZE)],
        [Math.ceil(gameState.view_right / TILE_SIZE), Math.ceil(gameState.view_bottom / TILE_SIZE)]
    ];
}
