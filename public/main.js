const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let gameState = {
    tiles: [],
    players: [],
};

const ws = new WebSocket('ws://localhost:8080');

ws.onopen = () => {
    ws.send(JSON.stringify({ player_id: null, action_type: 'join', x: 0, y: 0 }));
};

ws.onmessage = (event) => {
    gameState = JSON.parse(event.data);
    renderGame();
};

canvas.addEventListener('click', (event) => {
    const x = Math.floor(event.clientX / 20);
    const y = Math.floor(event.clientY / 20);
    ws.send(JSON.stringify({ player_id: 1, action_type: 'uncover', x, y }));
});

function renderGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    gameState.tiles.forEach(tile => {
        ctx.fillStyle = tile.is_mine ? 'red' : 'white';
        ctx.fillRect(tile.x * 20, tile.y * 20, 20, 20);
        if (!tile.is_mine && tile.adjacent_mines > 0) {
            ctx.fillStyle = 'black';
            ctx.fillText(tile.adjacent_mines, tile.x * 20 + 5, tile.y * 20 + 15);
        }
    });
    gameState.players.forEach(player => {
        ctx.fillStyle = player.color;
        ctx.fillText(`Player ${player.id}: ${player.score}`, 10, 20 * player.id);
    });
}