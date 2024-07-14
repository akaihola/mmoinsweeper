export function log(...args) {
    console.log(new Date().toISOString().substring(11, 23), ...args);
}