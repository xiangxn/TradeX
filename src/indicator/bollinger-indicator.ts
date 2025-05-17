import { BollingerBands } from "technicalindicators";
import { Candle } from "../utils/types";
import { Indicator, IndicatorValue } from "./base-indicator";
import { getTime } from "../utils/helper";

export class BollingerIndicator implements Indicator {
    name: string;
    period?: number | undefined;
    mult: number;
    values: IndicatorValue[];
    boll: BollingerBands;

    constructor(period: number = 20, mult: number = 2, name: string = "BOLL") {
        this.name = name;
        this.period = period;
        this.mult = mult;
        this.values = [];
        this.boll = new BollingerBands({ period: this.period, stdDev: this.mult, values: [] })
    }
    
    minPeriods() {
        return this.period!
    }

    update(candle: Candle) {
        const result = this.boll.nextValue(candle.close);
        if (result) {
            this.values.push({
                middle: result.middle,
                upper: result.upper,
                lower: result.lower,
                width: (result.upper - result.lower) / result.middle
            });
        }
        return result
    }
}