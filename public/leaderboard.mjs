import {gameState} from './game_state.mjs';
import {log} from "./utils.mjs";
import {safeSend} from './net/websocket.mjs';


let leaderboardContainer;
let leaderboardHandle;
let leaderboardTable;
let sortBy = 'score'; // Default sorting by score
let sortOrder = 'asc'; // Default sorting order ascending


export function initializeLeaderboard() {
    // Leaderboard logic
    leaderboardContainer = document.getElementById('leaderboard-container');
    leaderboardHandle = document.getElementById('leaderboard-handle');
    leaderboardTable = document.getElementById('leaderboard').getElementsByTagName('tbody')[0];

    // Ensure the handle is always visible
    function updateHandlePosition() {
        if (leaderboardContainer.style.left === '0px') {
            leaderboardHandle.style.left = '300px';
        } else {
            leaderboardHandle.style.left = '0px';
        }
    }

    leaderboardHandle.addEventListener('click', () => {
        if (leaderboardContainer.style.left === '0px') {
            leaderboardContainer.style.left = '-300px';
        } else {
            leaderboardContainer.style.left = '0px';
        }
        updateHandlePosition();
    });

    // Initialize the leaderboard position
    leaderboardContainer.style.left = '-300px';
    updateHandlePosition(); // Call this initially to set the correct position

    // Update handle position on window resize
    window.addEventListener('resize', updateHandlePosition);

    // MutationObserver to watch for changes in leaderboardContainer's style
    const observer = new MutationObserver(updateHandlePosition);
    observer.observe(leaderboardContainer, {attributes: true, attributeFilter: ['style']});

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
}

export function updateLeaderboard() {
    const visiblePlayers = getVisiblePlayers(getSortedPlayers(sortBy));
    leaderboardTable.innerHTML = '';
    visiblePlayers.forEach((player, index) => {
        const row = leaderboardTable.insertRow();
        row.insertCell(0).innerText = index + 1; // Rank
        const nameCell = row.insertCell(1);
        const playerName = player.name || 'Anonymous';
        nameCell.innerHTML = `
            <span class="player-name">${playerName}</span>
            ${player.id === gameState.player_id ? '<span class="edit-name">✎</span>' : ''}
        `;
        nameCell.style.backgroundColor = player.color;
        nameCell.style.color = 'black';
        log('Add player', player.id, 'to leaderboard. Name:', playerName, 'You are player', gameState.player_id);
        if (player.id === gameState.player_id) {
            nameCell.querySelector('.edit-name').addEventListener('click', () => editPlayerName(player));
        }
        row.insertCell(2).innerText = player.score; // Score
        row.insertCell(3).innerText = formatTime(player.join_time); // Time
        row.insertCell(4).innerText = player.tph.toFixed(2); // TPH
    });
}

function getSortedPlayers(sortBy) {
    const players = Object.values(gameState.players);
    players.forEach(player => {
        player.tph = player.score / ((new Date() - player.join_time) / 3600000); // Calculate TPH
    });
    players.sort((a, b) => {
        if (sortBy === 'score') {
            return sortOrder === 'asc' ? a.score - b.score : b.score - a.score;
        } else {
            return sortOrder === 'asc' ? a.tph - b.tph : b.tph - a.tph;
        }
    });
    return players;
}

function getVisiblePlayers(players) {
    return players;  // Return all players for now
}

// This function is not needed for now

function formatTime(joinTime) {
    const totalSeconds = Math.floor((new Date() - joinTime) / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    let timeString = '';
    if (hours > 0) timeString += `${hours}h `;
    if (hours > 0 || minutes > 0) timeString += `${minutes}m `;
    timeString += `${seconds}s`;
    return timeString.trim();
}

function editPlayerName(player) {
    const newName = prompt("Enter your new nickname:", player.name);
    if (newName && newName !== player.name) {
        safeSend(JSON.stringify({
            action_type: 'UpdateNickname',
            player_id: player.id,
            token: gameState.token,
            new_name: newName
        }));
    }
}

export function updatePlayerName(playerId, newName) {
    if (gameState.players[playerId]) {
        gameState.players[playerId].name = newName || 'Anonymous';
        log(`Updated player ${playerId} name to: ${gameState.players[playerId].name}`);
        updateLeaderboard();
    } else {
        console.error(`Player ${playerId} not found in gameState`);
    }
}

export function updatePlayersFromServer(players) {
    let updated = false;
    Object.entries(players).forEach(([playerIdStr, player]) => {
        const playerId = parseInt(playerIdStr);
        const existingPlayer = gameState.players[playerId];
        const updatedPlayer = {
            id: playerId,
            join_time: new Date(1000 * player.join_time),
            color: player.color,
            score: player.score,
            name: player.name || 'Anonymous'
        };

        if (!existingPlayer || JSON.stringify(existingPlayer) !== JSON.stringify(updatedPlayer)) {
            gameState.players[playerId] = updatedPlayer;
            updated = true;
        }
    });

    if (updated) {
        log('Players updated from server, refreshing leaderboard');
        updateLeaderboard();
    }
}
