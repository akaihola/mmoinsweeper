import { gameState, getVisibleArea } from './game_state.mjs';


// Leaderboard logic
const leaderboardContainer = document.getElementById('leaderboard-container');
const leaderboardHandle = document.getElementById('leaderboard-handle');
const leaderboardTable = document.getElementById('leaderboard').getElementsByTagName('tbody')[0];
let sortBy = 'score'; // Default sorting by score
let sortOrder = 'asc'; // Default sorting order ascending

leaderboardHandle.addEventListener('click', () => {
    if (leaderboardContainer.style.left === '0px') {
        leaderboardContainer.style.left = '-300px';
    } else {
        leaderboardContainer.style.left = '0px';
    }
});

document.getElementById('score-header').addEventListener('click', () => {
    sortBy = 'score';
    sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    updateLeaderboard();
});

document.getElementById('tph-header').addEventListener('click', () => {
    sortBy = 'tph';
    sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    updateLeaderboard();
});

export function updateLeaderboard() {
    const players = Object.values(gameState.players);
    players.forEach(player => {
        player.tph = player.score / ((Date.now() - player.joinTime) / 3600000); // Calculate TPH
    });
    players.sort((a, b) => {
        if (sortBy === 'score') {
            return sortOrder === 'asc' ? a.score - b.score : b.score - a.score;
        } else {
            return sortOrder === 'asc' ? a.tph - b.tph : b.tph - a.tph;
        }
    });

    const visiblePlayers = getVisiblePlayers(players);
    leaderboardTable.innerHTML = '';
    visiblePlayers.forEach((player, index) => {
        const row = leaderboardTable.insertRow();
        row.insertCell(0).innerText = index + 1; // Rank
        row.insertCell(1).innerText = player.name; // Name
        row.insertCell(2).innerText = player.score; // Score
        row.insertCell(3).innerText = formatTime(player.joinTime); // Time
        row.insertCell(4).innerText = player.tph.toFixed(2); // TPH
    });
}

function getVisiblePlayers(players) {
    const visiblePlayers = [];
    const currentPlayer = gameState.players[gameState.player_id];
    const currentPlayerIndex = players.findIndex(player => player.id === currentPlayer.id);

    if (currentPlayerIndex > 0) {
        visiblePlayers.push(players[currentPlayerIndex - 1]); // Player above
    }
    visiblePlayers.push(currentPlayer); // Current player
    if (currentPlayerIndex < players.length - 1) {
        visiblePlayers.push(players[currentPlayerIndex + 1]); // Player below
    }
    visiblePlayers.push(players[0]); // Top player

    const visibleArea = getVisibleArea();
    players.forEach(player => {
        if (player.id !== currentPlayer.id && isPlayerVisible(player, visibleArea)) {
            visiblePlayers.push(player);
        }
    });

    return visiblePlayers;
}

function isPlayerVisible(player, visibleArea) {
    return Object.values(gameState.tiles).some(tile => {
        return tile.player_id === player.id &&
            tile.x >= visibleArea[0][0] && tile.x <= visibleArea[1][0] &&
            tile.y >= visibleArea[0][1] && tile.y <= visibleArea[1][1];
    });
}

function formatTime(joinTime) {
    const totalSeconds = Math.floor((Date.now() - joinTime) / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
}
