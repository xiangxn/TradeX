import ccxt from 'ccxt';
import { Candle, KlineData } from '../utils/types';
import { eventBus } from "../core/event-bus"

export abstract class BaseFeed {
    protected exchange: any;
    public symbol: string;
    protected timeframe: string;
    protected lastTimestamp: number;
    protected lastPrice: number;
    public data: Candle[];
    public exchangeId: string | null;

    protected isRun: boolean = false

    constructor(exchangeId: string | null, symbol: string, timeframe: string = '1m') {
        this.exchangeId = exchangeId;
        if (exchangeId) {
            // @ts-ignore
            this.exchange = new ccxt.pro[exchangeId]();
        }
        this.symbol = symbol;
        this.timeframe = timeframe;
        this.lastTimestamp = 0;
        this.lastPrice = 0;
        this.data = [];
    }

    protected emitCandle(data: KlineData): void {
        eventBus.emit("candle", data)
    }

    protected emitPrice(price: number, timestamp: number): void {
        eventBus.emit("price", price, timestamp)
    }

    public stop(): void {
        this.isRun = false
    }

    public setData(data: Candle[]) {
        this.data = data
    }

    public getTimeframe() {
        return this.timeframe
    }

    public async init(): Promise<void> { }

    abstract run(): Promise<void>;

    async fetchHistoricalOHLCV(
        exchangeId: string | null,
        symbol: string,
        timeframe: string,
        limit: number
    ): Promise<Candle[]> {
        return []
    }
}
