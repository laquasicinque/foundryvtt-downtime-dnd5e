export function clamp(value: number, max: number, min = 0) {
    return Math.max(Math.min(max, value), min)
}
