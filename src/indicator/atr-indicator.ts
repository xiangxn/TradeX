import { ATR } from "technicalindicators";
import { Candle, IndicatorValue } from "../utils/types";
import { Indicator } from "./base-indicator";

export class ATRIndicator implements Indicator {
    name: string;
    period?: number | undefined;
    values: IndicatorValue[];
    atr: ATR;
    isDraw: boolean;

    constructor(period: number = 14, name: string = "ATR", isDraw: boolean = true) {
        this.isDraw = isDraw
        this.name = name
        this.period = period
        this.values = []
        this.atr = new ATR({ period: this.period, high: [], low: [], close: [] })
    }


    minPeriods() {
        return this.period!;
    }

    update(candle: Candle) {
        // @ts-ignore
        const result = this.atr.nextValue({ high: candle.high, low: candle.low, close: candle.close, period: this.period })
        if (result) {
            this.values.push(result)
        }
        return result
    }
}