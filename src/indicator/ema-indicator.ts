import { EMA as tEMA } from "technicalindicators";
import { Candle, IndicatorValue } from "../utils/types";
import { Indicator } from "./base-indicator";

export class EMA implements Indicator {
    name: string;
    period?: number | undefined;
    values: IndicatorValue[];
    ema: tEMA;
    isDraw: boolean;

    constructor(period: number = 14, name: string = "EMA", isDraw: boolean = true) {
        this.isDraw = isDraw;
        this.name = name;
        this.period = period;
        this.values = [];
        this.ema = new tEMA({ period: this.period, values: [] });
    }

    minPeriods() {
        return this.period!;
    }

    update(candle: Candle) {
        const result = this.ema.nextValue(candle.close);
        if (result) {
            this.values.push(result);
        }
        return result;
    }
}