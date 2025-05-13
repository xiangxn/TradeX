import { MultiValue } from "../indicator/base-indicator";
import { BollingerIndicator } from "../indicator/bollinger-indicator";
import { getTime } from "../utils/helper";
import { KlineData } from "../utils/types";
import { BaseStrategy } from "./base-strategy";

/**
 * ✅ 条件1：BBW < BBW_20th_percentile
BBW：布林带宽度 = (上轨 - 下轨) / 中轨

BBW 小于过去60根K线中 20% 分位值 → 表示市场正处于低波动期（震荡收敛）

✅ 条件2：volume > avg_volume * 1.5
放量条件 → 突破必须有“动能”配合

✅ 条件3：价格突破布林上轨 or 下轨
price > BB_upper：向上突破 → 做多

price < BB_lower：向下突破 → 做空

✅ 止盈止损：
take_profit = entry_price * 1.06：止盈6%

stop_loss = entry_price * 0.97：止损3%
 */
export class BollBreak extends BaseStrategy {
    private lookback: number;
    private bbwList: number[] = [];
    private percentile: number = 0.2; // 分位
    private volumes: number[] = [];
    private volumeCount: number = 5;
    private volumeMultiplier: number = 1.5;

    constructor(bollPeriod: number = 20, bollMult: number = 2) {
        super();
        this.lookback = 60;
        this.addIndicator(new BollingerIndicator(bollPeriod, bollMult));
    }

    protected override onPrice(price: number, timestamp: number): void {
        const pos = this.broker!.getPosition()
        if (pos) {
            if (pos.size > 0) {
                if (price >= pos.entryPrice * 1.06) {
                    this.sell({ price: price, amount: pos.size, timestamp })
                } else if (price <= pos.entryPrice * 0.97) {
                    this.sell({ price: price, amount: pos.size, timestamp })
                }
            } else if (pos.size < 0) {
                if (price <= pos.entryPrice * 0.96) {
                    this.buy({ price: price, amount: Math.abs(pos.size), timestamp })
                } else if (price >= pos.entryPrice * 1.03) {
                    this.buy({ price: price, amount: Math.abs(pos.size), timestamp })
                }
            }
        }
    }

    update(data: KlineData): void {
        // 交易量数据
        this.volumes.push(data.candle.volume)
        if (this.volumes.length > this.volumeCount) {
            this.volumes.splice(0, this.volumes.length - this.volumeCount)
        }

        // BOLL数据
        const bollValues = this.getIndicator<MultiValue>("BOLL")
        const boll = bollValues[bollValues.length - 1]
        this.bbwList.push((boll.upper - boll.lower) / boll.middle)
        if (this.bbwList.length > this.lookback) {
            this.bbwList.splice(0, this.bbwList.length - this.lookback)
        }
        // console.debug(`BBW Length: ${this.bbwList.length}/${this.lookback}`)
        if (this.bbwList.length >= this.lookback) {
            // 过去 lookback 根的布林带宽度 20% 分位数
            const bbws = this.bbwList.slice(-this.lookback)
            bbws.sort((a, b) => a - b)
            const bbw20Percentile = bbws[Math.floor(bbws.length * this.percentile)]

            // 平均成交量
            const avgVol = this.volumes.reduce((a, b) => a + b, 0) / this.volumes.length

            // 当前Boll宽度
            const width = this.bbwList[this.bbwList.length - 1]

            console.debug(`[BollBreak] bbw20Percentile: ${bbw20Percentile.toFixed(4)} | avgVol: ${avgVol.toFixed(2)} | width: ${width.toFixed(4)} | volume: ${data.candle.volume.toFixed(4)}, ${getTime(data.candle.timestamp)}`);
            // 开始判断条件
            if (width < bbw20Percentile && data.candle.volume > avgVol * this.volumeMultiplier) {
                // 判断是否有持仓
                let position = 0;
                const pos = this.broker!.getPosition()
                if (pos) {
                    position = pos.size
                }
                const close = data.candle.close;
                if (position > 0) {

                } else if (position < 0) {

                } else {
                    if (close > boll.upper) {
                        // 开多
                        this.buy({ price: close, amount: 0.001, timestamp: data.candle.timestamp })
                    } else if (close < boll.lower) {
                        // 开空
                        this.sell({ price: close, amount: 0.001, timestamp: data.candle.timestamp })
                    }
                }
            }
        }
    }

}