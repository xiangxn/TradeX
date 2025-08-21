import { Indicator } from "../indicator/base-indicator";
import { calculateSharpe, getTime } from "../utils/helper";
import { BalanceItem, Balances, KlineData, Order, Trade, DataStats, Line, IndicatorValue } from "../utils/types";
import { eventBus } from "../core/event-bus"

export class Statistics {
    protected initialBalance: Balances = {};
    protected finalBalance: Balances = {};
    protected profits: number[] = [];
    protected lastOrder: Order | null = null;
    protected symbol: string | null = null;
    protected base: string | null = null;
    protected quote: string | null = null;
    protected fees = 0;
    protected lines: Line[] = [];
    protected trades: Trade[] = [];
    protected equityCurve: BalanceItem[] = [];
    protected engine: any;

    constructor(engine: any) {
        this.engine = engine;
        eventBus.on('order:filled', this.onFill.bind(this));
        eventBus.on('position:closed', this.onPositionClose.bind(this));
        eventBus.on('balance:update', this.onBalanceUpdate.bind(this));
        eventBus.on('candle:indicator', this.onCandle.bind(this))
        eventBus.on('balance:init', (balances: Balances) => {
            this.initialBalance = { ...balances }
            this.finalBalance = balances
            this.equityCurve.push({ time: "", value: { ...this.finalBalance } })
        });
    }

    protected onCandle(data: { kline: KlineData, indicators: { [key: string]: IndicatorValue } }) {
        if (this.symbol === null) {
            this.symbol = data.kline.symbol;
            this.base = data.kline.symbol.split("/")[0];
            this.quote = data.kline.symbol.split("/")[1];
        }
        const timestamp = this.engine.alignmentTime(data.kline.candle.timestamp)
        let time = getTime(timestamp)
        this.lines.push({
            time,
            open: data.kline.candle.open,
            close: data.kline.candle.close,
            low: data.kline.candle.low,
            high: data.kline.candle.high,
            volume: data.kline.candle.volume,
            buy: false,
            sell: false,
            equity: {},
            price: data.kline.candle.close
        })
    }

    protected saveTrade(order: Order) {
        if (order.symbol !== this.symbol) {
            throw new Error('Symbol not match')
        }
        let time = getTime(order.timestamp)
        this.trades.push({
            time,
            price: order.price,
            side: order.side
        })
    }

    protected onPositionClose(order: Order): number {
        this.saveTrade(order);
        let pnl = 0;
        if (this.lastOrder) {
            if (this.lastOrder.side === 'buy') {
                pnl = (order.price - this.lastOrder.price) * order.amount;
            } else {
                pnl = (this.lastOrder.price - order.price) * order.amount;
            }
            this.profits.push(pnl)
            this.lastOrder = null;
        }
        return pnl
    }

    protected onFill(order: Order) {
        this.saveTrade(order);
        this.lastOrder = order;
        this.fees += order.fee ? order.fee : 0;
    }

    protected onBalanceUpdate(timestamp: number, balances: Balances) {
        this.finalBalance = balances
        this.equityCurve.push({
            time: getTime(timestamp),
            value: { ...this.finalBalance }
        });
        console.info('Balance Update:', balances);
    }

    public generateReport(): DataStats {
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
        let equity = {}
        for (const l of this.lines) {
            const index = this.equityCurve.findIndex((v) => v.time === l.time);
            if (index > -1) {
                equity = { ...this.equityCurve[index].value }
            }
            l.equity = { ...equity }
        }
        // 合并指标数据
        const strategies = this.engine.getStrategies();
        if (strategies.length > 0) {
            const indicators = strategies[0].getIndicators() as Map<string, Indicator>;
            this.lines.forEach((v, i) => {
                this.mergeIndicators(v, indicators, i, this.lines.length);
            })
        }

        const winTrades = this.profits.filter((v) => v >= 0);
        const loseTrades = this.profits.filter((v) => v < 0);
        const grossProfit = winTrades.reduce((a, b) => a + b, 0)
        const grossLoss = loseTrades.reduce((a, b) => Math.abs(a) + Math.abs(b), 0)

        const averageProfit = grossProfit / winTrades.length
        const averageLoss = grossLoss / loseTrades.length

        const winRate = this.profits.length > 0 ? winTrades.length / this.profits.length : 0

        const start = new Date(this.lines[0].time)
        const end = new Date(this.lines[this.lines.length - 1].time)
        const time = ((end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())) / 12
        const sharpeRatio = calculateSharpe(this.profits, this.profits.length / time)

        return {
            initialBalance: this.initialBalance,
            finalBalance: this.finalBalance,
            winTrades: winTrades.length,
            loseTrades: loseTrades.length,
            averageProfit,
            averageLoss,
            riskRewardRatio: averageProfit / averageLoss,
            profitFactor: grossProfit / grossLoss,
            winRate,
            maxDrawdown: this.caclMaxDrawdown(),
            sharpeRatio,
            fees: this.fees,
            lines: this.lines
        };
    }

    protected caclMaxDrawdown() {
        let maxDrawdown = 0;
        const data = this.equityCurve.filter((v) => v.value[this.base!] === this.initialBalance[this.base!])
        let peak = data[0].value[this.quote!];
        let i = 0
        for (const ec of data) {
            if (ec.value[this.quote!] > peak) peak = ec.value[this.quote!];
            const drawdown = (peak - ec.value[this.quote!]) / peak;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;
            i++
        }
        return maxDrawdown * 100
    }

    protected mergeIndicators(line: Line, indicators: Map<string, Indicator>, index: number, linesCount: number) {
        indicators.forEach(indicator => {
            if (!indicator.isDraw) return
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
