export function yyyymmddNumber(date) {
    return Number.parseInt(`${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2,0)}${date.getDate().toString().padStart(2, 0)}`);
}