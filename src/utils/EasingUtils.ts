export const easeInOutCubic = (t: number): number => {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export const easeOutCubic = (t: number): number => {
    return 1 - Math.pow(1 - t, 3);
}

export const easeOutQuad = (t: number): number => {
    return 1 - (1 - t) * (1 - t);
}
