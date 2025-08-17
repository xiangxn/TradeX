import { min } from "moment";
import { ATRIndicator } from "../indicator/atr-indicator";
import { MultiValue, SingleValue } from "../indicator/base-indicator";
import { BollingerIndicator } from "../indicator/bollinger-indicator";
import { MAVolumeIndicator } from "../indicator/volume-indicator";
import { getTime } from "../utils/helper";
import { KlineData } from "../utils/types";
import { BaseStrategy } from "./base-strategy";

/**
 * 
1️⃣ 进场逻辑
突破条件（布林带 + ATR 双确认）
价格突破布林带上轨（做多） / 下轨（做空）；
同时结合 ATR：
ATR < 均值：不进场，避免假突破；
ATR > 1.5 × ATR均值：确认波动放大，进场；
ATR > ATR均值：直接进场。
👉 目的：过滤震荡行情，只在波动扩大的“真突破”中进场。

2️⃣ 止损逻辑（风险控制）
动态止损 = min(凯利止损, ATR止损)
多单止损：止损价 = 入场价 − 𝑘 × 𝐴𝑇𝑅
        止损价=入场价−k×ATR
空单止损：止损价 = 入场价 + 𝑘 × 𝐴𝑇𝑅
        止损价=入场价+k×ATR
若 ATR 止损过大 → 用凯利公式的结果作为上限。
👉 目的：既能跟随波动变化，又不会因 ATR 过大而失控。

3️⃣ 止盈逻辑（双模式）
（A）默认模式（高效落袋）
使用 跟踪止盈（触发阈值 ≥ 1.5×ATR，避免太紧）。
当价格 跌破布林中轨 且 ATR < 均值 → 全止盈。

（B）强趋势模式（趋势持仓）
条件（同时满足）：
ATR 连续 N 根（如 6 根 5m K）高于均值；
价格运行在布林带 上/下轨 1/3 区间；
成交量维持放大。
执行：
分仓止盈：50% 先落袋（跟踪止盈），50% 持仓跟随趋势；
剩余仓位以“中轨 + ATR 衰退”作为止盈信号。
👉 目的：在强趋势下尽量吃到 8h+ 的大波动。

4️⃣ 策略优点
进场：突破+波动确认 → 提高信号质量，减少假突破。
止损：凯利 + ATR 动态控制 → 风险可控。
止盈：双模式（默认全止，强趋势才分仓） → 平衡效率和趋势收益。
适配 5m：兼顾短线高频 + 可能的长趋势行情。
 */
export class BollATR extends BaseStrategy {

    private minATR: number
    private maxPrice: number = 0
    private minPrice: number = 0
    private trailingStop: number = 0
    private lossStop: number = 0
    private trailingATR: number = 2
    private lossATR: number = 2.5
    private amount: number = 0.1
    private kVol: number = 1.5

    constructor(bollPeriod: number = 20, bollMult: number = 2, atrPeriod: number = 7, minATR: number = 20, trailingATR: number = 1.6, lossATR: number = 2.5, kVol: number = 1.5) {
        super({
            indicators: [
                new BollingerIndicator(bollPeriod, bollMult),
                new ATRIndicator(atrPeriod),
                new MAVolumeIndicator(5)
            ]
        });
        this.minATR = minATR
        this.trailingATR = trailingATR
        this.lossATR = lossATR
        this.kVol = kVol
    }

    update(data: KlineData): void {
        const close = data.candle.close;
        const atrValues = this.getIndicator<SingleValue>("ATR")
        const bollValues = this.getIndicator<MultiValue>("BOLL")
        const bollLast = bollValues.slice(-1)?.[0]
        const atrLast = atrValues.slice(-1)?.[0]
        const avgATR = calculateEMA(atrValues.slice(-5), 5).slice(-1)?.[0]
        const volValues = this.getIndicator<SingleValue>("MAVolume")
        const volLast = volValues.slice(-1)?.[0]
        const avgVol = calculateEMA(volValues.slice(-5), 5).slice(-1)?.[0]
        const avgBollWidth = calculateEMA(bollValues.slice(-5).map(item => item.width), 5).slice(-1)?.[0]

        // console.debug(`[ATRBoll] Close: ${close.toFixed(2)} | MA: ${bollLast?.middle?.toFixed(2)} | Upper: ${bollLast?.upper?.toFixed(2)} | Lower: ${bollLast?.lower?.toFixed(2)} | AvgATR: ${avgATR} | ATR: ${atrLast!}`)

        let position = 0;
        let entryPrice = 0;
        const pos = this.broker!.getPosition()
        if (pos) {
            position = pos.size;
            entryPrice = pos.entryPrice;
        }
        if (position > 0) {
            // if (close <= bollLast.middle) {
            //     this.sell({ price: close, amount: Math.abs(position), timestamp: data.candle.timestamp })
            // }
        } else if (position < 0) {
            // if (close >= bollLast.middle) {
            //     this.buy({ price: close, amount: Math.abs(position), timestamp: data.candle.timestamp })
            // }
        } else {
            if (close > bollLast.upper && avgATR > this.minATR && atrLast > avgATR && bollLast.width > avgBollWidth) {
                // 上轨突破逻辑
                this.maxPrice = close
                this.lossStop = close - this.lossATR * avgATR
                this.buy({ price: close, amount: this.amount, timestamp: data.candle.timestamp })
            } else if (close < bollLast.lower && avgATR > this.minATR && atrLast > avgATR && bollLast.width > avgBollWidth) {
                // 下轨突破逻辑
                this.minPrice = close
                this.lossStop = close + this.lossATR * avgATR
                this.sell({ price: close, amount: this.amount, timestamp: data.candle.timestamp })
            }
        }
    }

    protected override onPrice(price: number, timestamp: number): void {
        const pos = this.broker!.getPosition()
        if (pos) {
            const atrValues = this.getIndicator<SingleValue>("ATR")
            const atrLast = atrValues.slice(-1)?.[0]

            if (pos.size > 0) { // 做多
                this.maxPrice = Math.max(this.maxPrice, price)
                this.trailingStop = this.maxPrice - this.trailingATR * atrLast
                if (price <= this.trailingStop) {
                    // 止盈逻辑：动态止盈（跟踪止损）
                    this.maxPrice = 0
                    this.sell({ price: price, amount: pos.size, timestamp })
                } else if (price <= this.lossStop) {
                    // 止损逻辑：最高止损为 lossATR 倍 ATR，且不超过凯利公式得出的止损金额
                    this.lossStop = 0
                    this.sell({ price: price, amount: pos.size, timestamp })
                }

            } else if (pos.size < 0) {  // 做空
                this.minPrice = Math.min(this.minPrice, price)
                this.trailingStop = this.minPrice + this.trailingATR * atrLast
                if (price >= this.trailingStop) {
                    // 止盈逻辑：动态止盈（跟踪止损）
                    this.minPrice = 0
                    this.buy({ price: price, amount: Math.abs(pos.size), timestamp })
                } else if (price >= this.lossStop) {
                    // 止损逻辑：最低止损为 lossATR 倍 ATR，且不超过凯利公式得出的止损金额
                    this.lossStop = 0
                    this.buy({ price: price, amount: Math.abs(pos.size), timestamp })
                }
            }
        }
    }
}

function calculateEMA(atrArray: number[], period: number): number[] {
    if (atrArray.length === 0) return [];

    const alpha = 2 / (period + 1);
    const emaArray: number[] = [];

    // 第一项 EMA 直接用 ATR 本身
    emaArray[0] = atrArray[0];

    for (let i = 1; i < atrArray.length; i++) {
        emaArray[i] = alpha * atrArray[i] + (1 - alpha) * emaArray[i - 1];
    }

    return emaArray;
}