import { ATRIndicator } from "../indicator/atr-indicator";
import { MultiValue, SingleValue } from "../indicator/base-indicator";
import { BollingerIndicator } from "../indicator/bollinger-indicator";
import { EMA } from "../indicator/ema-indicator";
import { KlineData } from "../utils/types";
import { BaseStrategy } from "./base-strategy";
import { calculateEMA } from "../utils/helper";
import { DonchianIndicator } from "../indicator/donchian-indicator";
import { RSIIndicator } from "../indicator/rsi-indicator";
import { MAVolumeIndicator } from "../indicator/volume-indicator";
import { ADXIndicator } from "../indicator/adx-indicator";

export class Polymeric extends BaseStrategy {

    private amount: number = 0.1
    private trailingATR: number = 2
    private lossATR: number = 1
    private maxPrice: number = 0
    private minPrice: number = 0
    private trailingStop: number = 0
    private lossStop: number = 0
    private isTrend: boolean = false

    constructor(bollPeriod: number = 20, bollMult: number = 2, atrPeriod: number = 14) {
        super({
            indicators: [
                new BollingerIndicator(bollPeriod, bollMult),
                new ATRIndicator(atrPeriod),
                new EMA(20, "EMA20"),
                new EMA(60, "EMA60"),
                new RSIIndicator(),
                new MAVolumeIndicator(),
                new ADXIndicator()
            ]
        })
    }
    update(data: KlineData): void {
        const close = data.candle.close;
        const atrValues = this.ATR.values
        const avgATR = calculateEMA(atrValues.slice(-5), 5).slice(-1)?.[0]
        const smaATR = atrValues.slice(-5).reduce((a: number, b: number) => a + b, 0) / 5
        const bollValues = this.BOLL.values
        const avgBollWidth = calculateEMA(bollValues.slice(-5).map((boll: MultiValue) => boll.width), 5).slice(-1)?.[0]
        const boll = bollValues.slice(-1)?.[0]
        const atr = atrValues.slice(-1)?.[0]
        const ema20 = this.EMA20.values.slice(-1)?.[0]
        const ema60 = this.EMA60.values.slice(-1)?.[0]
        const adx = this.ADX.values[this.ADX.values.length - 1]
        const rsi = this.RSI.values.slice(-1)?.[0]
        const volValues = this.MAVolume.values
        const vol = volValues.slice(-1)?.[0]
        const avgSMAVol = volValues.slice(-5).reduce((a: number, b: number) => a + b, 0) / 5

        let position = 0;
        let entryPrice = 0;
        const pos = this.broker!.getPosition()
        if (pos) {
            position = pos.size;
            entryPrice = pos.entryPrice;
        }
        if (position === 0) {
            // 趋势判定
            if (adx.adx > 25 && atr > avgATR) {    // 趋势
                this.isTrend = true
                if (ema20 > ema60 && close > boll.upper) {   // 多头趋势
                    this.maxPrice = close
                    this.lossStop = close - this.lossATR * avgATR
                    this.buy({ price: close, amount: this.amount * 2, timestamp: data.candle.timestamp })
                } else if (ema20 < ema60 && close < boll.lower) {  // 空头趋势
                    this.minPrice = close
                    this.lossStop = close + this.lossATR * avgATR
                    this.sell({ price: close, amount: this.amount * 2, timestamp: data.candle.timestamp })
                }
            } else {  // 震荡
                this.isTrend = false
                if (boll.width < avgBollWidth && atr < smaATR) {
                    if (vol < avgSMAVol) {
                        if (rsi < 30) { // 买在超卖区
                            this.buy({ price: close, amount: this.amount, timestamp: data.candle.timestamp })
                        } else if (rsi > 70) {    // 卖在超买区
                            this.sell({ price: close, amount: this.amount, timestamp: data.candle.timestamp })
                        }
                    }
                }
            }
        }
    }

    protected override onPrice(price: number, timestamp: number): void {
        const pos = this.broker!.getPosition()
        if (pos) {
            const atr = this.ATR.values.slice(-1)?.[0]
            const rsi = this.RSI.values.slice(-1)?.[0]
            const boll = this.BOLL.values.slice(-1)?.[0]
            // 止盈逻辑
            if (pos.size > 0) { // 做多
                if (this.isTrend) {
                    this.maxPrice = Math.max(this.maxPrice, price)
                    this.trailingStop = this.maxPrice - this.trailingATR * atr
                    if (price <= this.trailingStop) {
                        // 止盈逻辑：动态止盈（跟踪止损）
                        this.maxPrice = 0
                        this.sell({ price: price, amount: pos.size, timestamp })
                    } else if (price <= this.lossStop) {
                        // 止损逻辑：最高止损为 lossATR 倍 ATR，且不超过凯利公式得出的止损金额
                        this.lossStop = 0
                        this.sell({ price: price, amount: pos.size, timestamp })
                    }
                } else {
                    if (rsi > 60 || price >= boll.middle) {
                        this.sell({ price: price, amount: pos.size, timestamp })
                    }
                }
            } else if (pos.size < 0) {  // 做空
                if (this.isTrend) {
                    this.minPrice = Math.min(this.minPrice, price)
                    this.trailingStop = this.minPrice + this.trailingATR * atr
                    if (price >= this.trailingStop) {
                        // 止盈逻辑：动态止盈（跟踪止损）
                        this.minPrice = 0
                        this.buy({ price: price, amount: Math.abs(pos.size), timestamp })
                    } else if (price >= this.lossStop) {
                        // 止损逻辑：最低止损为 lossATR 倍 ATR，且不超过凯利公式得出的止损金额
                        this.lossStop = 0
                        this.buy({ price: price, amount: Math.abs(pos.size), timestamp })
                    }
                } else {
                    if (rsi < 40 || price <= boll.middle) {
                        this.buy({ price: price, amount: Math.abs(pos.size), timestamp })
                    }
                }
            }
        }
    }
}