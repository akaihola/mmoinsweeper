import {gameState} from "../game_state.mjs";
import {updateUIState} from "../ui/uiState.mjs";
import {TILE_SIZE} from "../ui/defaults.mjs";
import {updateLeaderboard, updatePlayerName, updatePlayersFromServer} from "../leaderboard.mjs";
import {renderGame} from "../ui/gameRenderer.mjs";
import {registerResponseHandler} from "./websocket.mjs";

export function getJoinAction(horizontalTiles, verticalTiles, storedToken) {
    return {
        action_type: 'Join',
        visible_area: [
            [Math.floor(-horizontalTiles / 2), Math.ceil(-verticalTiles / 2)],  // left, top
            [Math.floor(horizontalTiles / 2), Math.ceil(verticalTiles / 2)]  // right, bottom
        ],
        token: storedToken
    };
}

export function handleJoinResponse(response) {
    gameState.playing = true;
    gameState.player_id = response.player_id;
    gameState.token = response.token;
    localStorage.setItem('playerToken', response.token);
    updateUIState({
        view_left: TILE_SIZE * response.update_area[0][0],
        view_top: TILE_SIZE * response.update_area[0][1],
        view_right: TILE_SIZE * response.update_area[1][0],
        view_bottom: TILE_SIZE * response.update_area[1][1]
    });
    updatePlayers(response);
}

export function updatePlayers(response) {
    Object.entries(response.players).forEach(([playerIdStr, player]) => {
        const playerId = parseInt(playerIdStr);
        gameState.players[playerId] = {
            id: playerId,
            join_time: new Date(1000 * player.join_time),
            color: player.color,
            score: player.score,
            name: player.name || 'Anonymous'
        };
    });
}

export function registerResponseHandlers() {
// Register default message handlers
    registerResponseHandler('Joined', (response) => {
        handleJoinResponse(response);
        updatePlayers(response);
        updateLeaderboard();
        renderGame(true);
    });

    registerResponseHandler('Updated', (response) => {
        updatePlayers(response);
        updateLeaderboard();
        renderGame(true);
    });

    registerResponseHandler('Uncovered', (response) => {
        if (response.players) {
            updatePlayersFromServer(response.players);
        }
        updateLeaderboard();
        renderGame(false);
    });

    registerResponseHandler('Error', (response) => {
        console.error('Error:', response.message);
    });

    registerResponseHandler('NicknameUpdated', (response) => {
        updatePlayerName(response.player_id, response.new_name);
    });
}