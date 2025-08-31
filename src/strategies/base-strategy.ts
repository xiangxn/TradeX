import { eventBus } from '../core/event-bus';
import { BaseFeed } from '../feed/base-feed';
import { BaseBroker } from '../broker/base-broker';
import { BuySell, KlineData, Order, IndicatorValue, Candle } from '../utils/types';
import { Indicator } from '../indicator/base-indicator';
import { getAggregateMs, getTime } from '../utils/helper';

interface StrategyOptions {
    indicators?: Indicator[];
}

export abstract class BaseStrategy {
    protected broker?: BaseBroker;
    protected feed?: BaseFeed;
    protected order?: Order;
    protected indicators: Map<string, Indicator> = new Map();
    protected klines: KlineData[] = [];
    private inited: boolean = false;
    protected maxPeriod: number = 0;
    [key: string]: any;


    constructor(options?: StrategyOptions) {
        if (options?.indicators) {
            for (const indicator of options.indicators) {
                this.indicators.set(indicator.name, indicator);
            }
        }
        return new Proxy(this, {
            get: (target, prop: string, receiver) => {
                if (target.indicators.has(prop)) {
                    return target.indicators.get(prop);
                }
                return Reflect.get(target, prop, receiver);
            }
        });
    }

    abstract update(data: KlineData): void;
    protected onPrice(price: number, timestamp: number): void { }

    private onCandle(data: KlineData): void {
        let indicators: { [key: string]: IndicatorValue } = {}
        for (const indicator of this.indicators.values()) {
            let value = indicator.update(data.candle);
            indicators[indicator.name] = value;
        }
        eventBus.emit("candle:indicator", { kline: data, indicators })
        this.klines.push(data);
        this.update(data);
        if (this.klines.length > this.maxPeriod) {
            this.klines.shift();
        }
    }

    onOrderFill(order: Order): void {
        this.order = order;
    }

    async onInit(): Promise<void> {
        for (const indicator of this.indicators.values()) {
            const p = indicator.minPeriods() ?? 0
            if (p > this.maxPeriod) this.maxPeriod = p;
        }
        if (this.maxPeriod > 0) {
            let datas = await this.feed?.fetchHistoricalOHLCV(this.feed.exchangeId, this.feed.symbol, this.feed.getTimeframe(), this.maxPeriod)
            if (datas) {
                for (const data of datas) {
                    this.klines.push({ symbol: this.feed!.symbol, timeframe: this.feed!.getTimeframe(), candle: data });
                    for (const indicator of this.indicators.values()) {
                        indicator.update(data);
                    }
                    if (this.klines.length > this.maxPeriod) {
                        this.klines.shift();
                    }
                }
            }
        }
    };

    async init(broker: BaseBroker, feed: BaseFeed): Promise<void> {
        if (this.inited) return
        this.broker = broker
        this.feed = feed
        eventBus.on('candle', this.onCandle.bind(this))
        eventBus.on('price', this.onPrice.bind(this))
        eventBus.on('order:filled', this.onOrderFill.bind(this))
        await this.onInit() // 可以初始化余额与持仓
        this.inited = true
    }

    buy(params: BuySell): void {
        const quote = this.broker!.getQuoteSymbol(this.feed!.symbol)
        if (this.broker?.checkBalance(quote, params.price * params.amount)) {
            console.info("Buy:", { ...params, timestamp: getTime(params.timestamp) })
            eventBus.emit("signal:buy", { ...params, timestamp: this.alignmentTime(params.timestamp) })
        } else {
            eventBus.emit("balance:insufficient", { symbol: quote })
        }
    }

    sell(params: BuySell): void {
        const base = this.broker!.getBaseSymbol(this.feed!.symbol)
        if (this.broker?.checkBalance(base, params.amount)) {
            console.info("Sell:", { ...params, timestamp: getTime(params.timestamp) });
            eventBus.emit("signal:sell", { ...params, timestamp: this.alignmentTime(params.timestamp) });
        } else {
            eventBus.emit("balance:insufficient", { symbol: base })
        }
    }

    private alignmentTime(timestamp: number) {
        const timeframe = getAggregateMs(this.feed!.getTimeframe())
        return Math.floor(timestamp / timeframe) * timeframe
    }

    public getIndicator<T = IndicatorValue>(name: string): T[] {
        return this.indicators.get(name)?.values as T[];
    }

    public addIndicator(indicator: Indicator): void {
        this.indicators.set(indicator.name, indicator);
    }

    public getIndicators(): Map<string, Indicator> {
        return this.indicators;
    }

    public mergeKlines(klines: KlineData[], factor: number): Candle[] {
        const merged: Candle[] = [];
        for (let i = 0; i < klines.length; i += factor) {
            const slice = klines.slice(i, i + factor);
            if (slice.length < factor) break;
            merged.push({
                timestamp: slice[0].candle.timestamp,
                open: slice[0].candle.open,
                high: Math.max(...slice.map(k => k.candle.high)),
                low: Math.min(...slice.map(k => k.candle.low)),
                close: slice[slice.length - 1].candle.close,
                volume: slice.reduce((s, k) => s + k.candle.volume, 0)
            });
        }
        return merged;
    }
}
