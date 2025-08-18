import moment from "moment";

export function getTime(timestamp: number): string {
    return moment(timestamp).format('YYYY-MM-DD HH:mm')
}

export function getAggregateMs(aggregateTimeframe: string): number {
    switch (aggregateTimeframe) {
        case '1m': return 60 * 1000
        case '5m': return 5 * 60 * 1000
        case '15m': return 15 * 60 * 1000
        case '30m': return 30 * 60 * 1000
        case '1h': return 60 * 60 * 1000
        case '2h': return 2 * 60 * 60 * 1000
        case '4h': return 4 * 60 * 60 * 1000
        case '1d': return 24 * 60 * 60 * 1000
        default: throw new Error('Unsupported aggregate timeframe')
    }
}

export function truncate(num: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.trunc(num * factor) / factor;
}