import { RSI } from "technicalindicators";
import { Candle } from "../utils/types";
import { Indicator, IndicatorValue } from "./base-indicator";


export class RSIIndicator implements Indicator {
    name: string;
    period?: number | undefined;
    values: IndicatorValue[];
    rsi: RSI;

    constructor(period: number = 14, name: string = "RSI") {
        this.name = name;
        this.period = period;
        this.values = [];
        this.rsi = new RSI({ period, values: [] })
    }

    update(candle: Candle): void {
        const result = this.rsi.nextValue(candle.close);
        if (result) {
            this.values.push(result);
        }
    }
}