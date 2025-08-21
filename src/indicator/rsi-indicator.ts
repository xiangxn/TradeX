import { RSI } from "technicalindicators";
import { Candle, IndicatorValue } from "../utils/types";
import { Indicator } from "./base-indicator";


export class RSIIndicator implements Indicator {
    name: string;
    period?: number | undefined;
    values: IndicatorValue[];
    rsi: RSI;
    isDraw: boolean;

    constructor(period: number = 14, name: string = "RSI", isDraw: boolean = false) {
        this.isDraw = isDraw
        this.name = name;
        this.period = period;
        this.values = [];
        this.rsi = new RSI({ period, values: [] })
    }

    minPeriods() {
        return this.period!
    }

    update(candle: Candle) {
        const result = this.rsi.nextValue(candle.close);
        if (result) {
            this.values.push(result);
        }
        return result
    }
}