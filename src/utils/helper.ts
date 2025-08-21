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

export function calculateEMA(data: number[], period: number): number[] {
    if (data.length < period) {
        throw new Error('Data length must be greater than or equal to period');
    }

    const ema: number[] = [];
    const alpha = 2 / (period + 1);

    // 初始EMA为前period个数据的SMA
    let sum = 0;
    for (let i = 0; i < period; i++) {
        sum += data[i];
    }
    ema.push(sum / period);

    // 计算后续EMA值
    for (let i = period; i < data.length; i++) {
        const currentEMA = data[i] * alpha + ema[i - period] * (1 - alpha);
        ema.push(currentEMA);
    }

    return ema;
}

export function calculateSharpe(returns: number[], periodsPerYear: number): number {
    const n = returns.length;
    if (n <= 1) return 0;

    const mean = returns.reduce((a, b) => a + b, 0) / n;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1);
    const stdDev = Math.sqrt(variance);

    const sharpe = (mean / stdDev) * Math.sqrt(periodsPerYear);
    return sharpe;
}

export function calculateEMAROC(ema: number[]): number {
    return (ema[ema.length - 1] - ema[0]) / ema[0] * 100
}