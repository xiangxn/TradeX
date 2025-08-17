import { eventBus } from '../core/event-bus';
import { BaseFeed } from '../feed/base-feed';
import { BaseBroker } from '../broker/base-broker';
import { BuySell, KlineData, Order } from '../utils/types';
import { Indicator, IndicatorValue } from '../indicator/base-indicator';
import { getAggregateMs, getTime } from '../utils/helper';

interface StrategyOptions {
    indicators?: Indicator[];
}

export abstract class BaseStrategy {
    protected broker?: BaseBroker;
    protected feed?: BaseFeed;
    protected order?: Order;
    protected indicators: Map<string, Indicator> = new Map();
    private inited: boolean = false;
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
        for (const indicator of this.indicators.values()) {
            indicator.update(data.candle);
        }
        this.update(data);
    }

    onOrderFill(order: Order): void {
        this.order = order;
    }

    async onInit(): Promise<void> {
        let maxPeriod = 0;
        for (const indicator of this.indicators.values()) {
            const p = indicator.minPeriods() ?? 0
            if (p > maxPeriod) maxPeriod = p;
        }
        if (maxPeriod > 0) {
            let datas = await this.feed?.fetchHistoricalOHLCV(this.feed.exchangeId, this.feed.symbol, this.feed.getTimeframe(), maxPeriod)
            if (datas) {
                for (const data of datas) {
                    for (const indicator of this.indicators.values()) {
                        indicator.update(data);
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
}
