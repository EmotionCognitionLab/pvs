export function yyyymmddNumber(date) {
    return Number.parseInt(yyyymmddString(date));
}

export function yyyymmddString(date) {
    return `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2,0)}${date.getDate().toString().padStart(2, 0)}`;
}