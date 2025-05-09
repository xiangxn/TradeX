import moment from "moment";

export function getTime(timestamp: number): string {
    return moment(timestamp).format('YYYY-MM-DD HH:mm')
}