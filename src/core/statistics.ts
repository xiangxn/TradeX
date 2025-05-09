import { Indicator } from "../indicator/base-indicator";
import { getTime } from "../utils/helper";
import { BalanceItem, Balances, KlineData, Order, Trade, DataStats, Line } from "../utils/types";
import { eventBus } from "./event-bus"
import moment from "moment"

export class Statistics {
    private initialBalance = 0;
    private finalBalance = 0;
    private winTrades = 0;
    private loseTrades = 0;
    private lastOrder: Order | null = null;
    private quote: string;
    private fees = 0;
    private lines: Line[] = [];
    private trades: Trade[] = [];
    private equityCurve: BalanceItem[] = [];
    private engine: any;

    constructor(engine: any, quote: string) {
        this.engine = engine;
        this.quote = quote;
        eventBus.on('order:filled', this.onFill.bind(this));
        eventBus.on('position:closed', this.onPositionClose.bind(this));
        eventBus.on('balance:update', this.onBalanceUpdate.bind(this));
        eventBus.on('candle', this.onCandle.bind(this))
        eventBus.on('balance:init', (balances: Balances) => {
            this.initialBalance = balances[this.quote]
            this.finalBalance = balances[this.quote]
            this.equityCurve.push({ time: "", value: this.finalBalance })
        });
    }

    private onCandle(data: KlineData) {
        let time = getTime(data.candle.timestamp)
        this.lines.push({
            time,
            open: data.candle.open,
            close: data.candle.close,
            low: data.candle.low,
            high: data.candle.high,
            volume: data.candle.volume,
            buy: false,
            sell: false,
            equity: 0,
            price: 0
        })
    }

    private saveTrade(order: Order) {
        let time = getTime(order.timestamp)
        this.trades.push({
            time,
            price: order.price,
            side: order.side
        })
    }

    onPositionClose(order: Order) {
        this.saveTrade(order);
        if (this.lastOrder) {
            let pnl = 0;
            if (this.lastOrder.side === 'buy') {
                pnl = (order.price - this.lastOrder.price) * order.amount;
                if (pnl > 0) {
                    this.winTrades++;
                } else {
                    this.loseTrades++;
                }
            } else {
                pnl = (this.lastOrder.price - order.price) * order.amount;
                if (pnl > 0) {
                    this.winTrades++;
                } else {
                    this.loseTrades++;
                }
            }
            this.lastOrder = null;
        }
    }

    onFill(order: Order) {
        this.saveTrade(order);
        this.lastOrder = order;
        this.fees += order.fee ? order.fee : 0;
    }

    onBalanceUpdate(timestamp: number, balances: Balances) {
        this.finalBalance = balances[this.quote]
        this.equityCurve.push({
            time: getTime(timestamp),
            value: this.finalBalance
        });
        console.info('Balance Update:', balances[this.quote]);
    }

    generateReport(): DataStats {
        // 合并交易数据
        for (const trade of this.trades) {
            const index = this.lines.findIndex((v) => v.time === trade.time);
            if (index > -1) {
                this.lines[index].price = trade.price;
                if (trade.side === 'buy') {
                    this.lines[index].buy = true;
                } else {
                    this.lines[index].sell = true;
                }
            }
        }
        // 合并余额数据
        this.equityCurve[0].time = this.lines[0].time;
        let equity = 0
        for (const l of this.lines) {
            const index = this.equityCurve.findIndex((v) => v.time === l.time);
            if (index > -1) {
                equity = this.equityCurve[index].value
            }
            l.equity = equity;
        }
        // 合并指标数据
        const strategies = this.engine.getStrategies();
        if (strategies.length > 0) {
            const indicators = strategies[0].getIndicators() as Map<string, Indicator>;
            this.lines.forEach((v, i) => {
                this.mergeIndicators(v, indicators, i, this.lines.length);
            })
        }

        return {
            initialBalance: this.initialBalance,
            finalBalance: this.finalBalance,
            winTrades: this.winTrades,
            loseTrades: this.loseTrades,
            fees: this.fees,
            lines: this.lines
        };
    }

    mergeIndicators(line: Line, indicators: Map<string, Indicator>, index: number, linesCount: number) {
        indicators.forEach(indicator => {
            const data = indicator.values.length > linesCount ? indicator.values.slice(indicator.values.length - linesCount) : indicator.values
            const value = data[index];
            if (value === null || typeof value === 'number') {
                line[indicator.name] = value;
            } else if (typeof value === 'object') {
                Object.entries(value).forEach(([subName, subValue]) => {
                    const key = `${indicator.name.toUpperCase()}_${subName.toUpperCase()}`;
                    line[key] = subValue;
                });
            }
        });
    }
}
