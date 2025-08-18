import { ADXIndicator } from "../indicator/adx-indicator";
import { BollingerIndicator } from "../indicator/bollinger-indicator";
import { RSIIndicator } from "../indicator/rsi-indicator";
import { KlineData } from "../utils/types";
import { BaseStrategy } from "./base-strategy";

export class BollADXRSI extends BaseStrategy {

    constructor(bollPeriod: number = 106, bollMult: number = 2, rsiPeriod: number = 14, adxPeriod: number = 14) {
        super();
        this.addIndicator(new BollingerIndicator(bollPeriod, bollMult));
        this.addIndicator(new RSIIndicator(rsiPeriod));
        this.addIndicator(new ADXIndicator(adxPeriod));
    }

    protected override onPrice(price: number, timestamp: number): void {
        const pos = this.broker!.getPosition()
        if (pos) {
            if (pos.size > 0) {
                if (price >= pos.entryPrice * 1.04) {
                    this.sell({ price: price, amount: pos.size, timestamp })
                }
                else if (price <= pos.entryPrice * 0.98) {
                    this.sell({ price: price, amount: pos.size, timestamp })
                }
            } else if (pos.size < 0) {
                if (price <= pos.entryPrice * 0.96) {
                    this.buy({ price: price, amount: Math.abs(pos.size), timestamp })
                }
                else if (price >= pos.entryPrice * 1.02) {
                    this.buy({ price: price, amount: Math.abs(pos.size), timestamp })
                }
            }
        }
    }

    update(data: KlineData): void {
        const close = data.candle.close;
        let position = 0;
        let entryPrice = 0;
        const pos = this.broker!.getPosition()
        if (pos) {
            position = pos.size;
            entryPrice = pos.entryPrice;
        }
        const boll = this.BOLL.values[this.BOLL.values.length - 1]
        const rsi = this.RSI.values[this.RSI.values.length - 1]
        const adx = this.ADX.values[this.ADX.values.length - 1]

        if (position === 0) {
            if (adx.adx > 25 && boll.width > 0.05 && adx.pdi > adx.mdi) {
                // 多头趋势
                if (close >= boll.upper && rsi > 60) {
                    this.buy({ price: close, amount: 0.1, timestamp: data.candle.timestamp })
                }
            } else if (adx.adx > 25 && boll.width > 0.05 && adx.pdi < adx.mdi) {
                // 空头趋势
                if (close <= boll.lower && rsi < 40) {
                    this.sell({ price: close, amount: 0.1, timestamp: data.candle.timestamp })
                }
            } else if (adx.adx < 20 && boll.width < 0.03) {
                // 震荡
                // if (close >= boll.upper && rsi > 70) {
                //     this.sell({ price: close, amount: 0.001, timestamp: data.candle.timestamp })
                // } else if (close <= boll.lower && rsi < 30) {
                //     this.buy({ price: close, amount: 0.001, timestamp: data.candle.timestamp })
                // }
            } else {
                // 中性/不明 不操作
            }
        } else if (position > 0) {
            if (close <= boll.middle) {
                this.sell({ price: close, amount: position, timestamp: data.candle.timestamp })
            }
        } else {
            if (close >= boll.middle) {
                this.buy({ price: close, amount: Math.abs(position), timestamp: data.candle.timestamp })
            }
        }

    }

}