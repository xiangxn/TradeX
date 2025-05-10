// 定义交易类型
export type MarketType = 'spot' | 'perp';

export interface Balances { [symbol: string]: number }

export interface Position { symbol: string, size: number, entryPrice: number }

export interface Candle {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface BuySell {
    price: number;
    amount: number;
    timestamp: number;
}

export interface BalanceItem { time: string; value: number; }

export interface KlineData {
    symbol: string;
    timeframe: string;
    candle: Candle;
}

export interface Order {
    side: 'buy' | 'sell';
    symbol: string;
    price: number;
    amount: number;
    cost: number;
    timestamp: number;
    fee?: number;
}

export interface Trade {
    time: string;
    price: number;
    side: 'buy' | 'sell';
}

export interface Line {
    time: string
    equity: number
    buy: boolean
    sell: boolean
    price: number
    open: number
    high: number;
    low: number;
    close: number
    volume: number
    [key: string]: any
}

export interface DataStats {
    initialBalance: number
    finalBalance: number
    fees: number
    winTrades: number
    loseTrades: number
    averageProfit: number
    averageLoss: number
    profitFactor: number
    maxDrawdown: number
    lines: Line[]
}