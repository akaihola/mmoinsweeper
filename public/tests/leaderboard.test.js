// See https://medium.com/dailyjs/running-mocha-tests-as-native-es6-modules-in-a-browser-882373f2ecb0

import { gameState } from '../game_state.mjs';
import { initializeLeaderboard, updateLeaderboard } from '../leaderboard.mjs';

const { assert } = chai;

describe('Leaderboard Tests', () => {
  let testContainer;

  before(() => {
    // Create a non-visible test container
    testContainer = document.createElement('div');
    testContainer.style.position = 'absolute';
    testContainer.style.top = '-9999px';
    testContainer.style.left = '-9999px';
    document.body.appendChild(testContainer);
  });

  beforeEach(() => {
    // Reset gameState before each test
    gameState.player_id = 1;
    gameState.players = {};
    gameState.tiles = {};

    // Clear and set up the test container
    testContainer.innerHTML = `
      <div id="leaderboard-container">
        <div id="leaderboard-handle">☰</div>
        <table id="leaderboard">
          <thead>
            <tr>
              <th id="rank-header"></th>
              <th id="name-header">Name</th>
              <th id="score-header">Score</th>
              <th id="time-header">Time</th>
              <th id="tph-header">TPH</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    `;

    // Mock the log function
    window.log = console.log;

    // Mock the getVisibleArea function
    window.getVisibleArea = () => [[0, 0], [10, 10]];

    // Mock the isPlayerVisible function (assume all players are visible)
    window.isPlayerVisible = () => true;

    initializeLeaderboard();
  });

  after(() => {
    // Remove the test container after all tests
    document.body.removeChild(testContainer);
  });

  it('should not show duplicate entry for current player', () => {
    // Set up the game state
    gameState.player_id = 1;
    gameState.players = {
      1: { id: 1, name: 'Player 1', score: 100, join_time: new Date(), color: '#ff0000' },
      2: { id: 2, name: 'Player 2', score: 200, join_time: new Date(), color: '#00ff00' },
      3: { id: 3, name: 'Player 3', score: 300, join_time: new Date(), color: '#0000ff' },
    };

    // Update the leaderboard
    updateLeaderboard();

    // Get the leaderboard rows
    const leaderboardRows = document.querySelectorAll('#leaderboard tbody tr');

    // Check that there are exactly 3 rows (one for each player)
    assert.strictEqual(leaderboardRows.length, 3, 'Leaderboard should have exactly 3 rows');

    // Check that the current player (Player 1) appears only once
    const player1Entries = Array.from(leaderboardRows).filter(row => 
      row.cells[1].textContent.includes('Player 1')
    );
    assert.strictEqual(player1Entries.length, 1, 'Current player should appear only once in the leaderboard');
  });
});
