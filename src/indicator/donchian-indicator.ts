import { Candle, IndicatorValue } from "../utils/types";
import { Indicator } from "./base-indicator";

export class DonchianIndicator implements Indicator {
    name: string;
    period: number;
    values: IndicatorValue[];
    highs: number[];
    lows: number[];
    isDraw: boolean;

    constructor(period: number = 20, name: string = "Donchian", isDraw: boolean = false) {
        this.name = name;
        this.period = period;
        this.values = [];
        this.highs = [];
        this.lows = [];
        this.isDraw = isDraw;
    }


    minPeriods() {
        return this.period;
    }

    update(candle: Candle) {
        this.highs.push(candle.high);
        this.lows.push(candle.low);

        // 保持数据长度不超过周期
        if (this.highs.length > this.period) {
            this.highs.shift();
            this.lows.shift();
        }

        const upper = Math.max(...this.highs);
        const lower = Math.min(...this.lows);
        const middle = (upper + lower) / 2;

        this.values.push({ upper, lower, middle });
        return { upper, lower, middle };
    }
}