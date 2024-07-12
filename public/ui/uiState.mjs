export const uiState = {
    view_left: 0,
    view_top: 0,
    view_right: 0,
    view_bottom: 0
};

export function updateUIState(newState) {
    Object.assign(uiState, newState);
}
