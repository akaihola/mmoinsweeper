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