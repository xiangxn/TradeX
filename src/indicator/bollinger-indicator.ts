import { BollingerBands } from "technicalindicators";
import { Candle } from "../utils/types";
import { Indicator, IndicatorValue } from "./base-indicator";
import { getTime } from "../utils/helper";

export class BollingerIndicator implements Indicator {
    name: string;
    period?: number | undefined;
    mult: number;
    values: IndicatorValue[];
    closePrices: number[];

    constructor(period: number = 20, mult: number = 2, name: string = "BOLL") {
        this.name = name;
        this.period = period;
        this.mult = mult;
        this.values = [];
        this.closePrices = [];
    }

    update(candle: Candle): void {
        this.closePrices.push(candle.close);
        if (this.closePrices.length > this.period!) {
            this.closePrices.splice(0, this.closePrices.length - this.period!);
        }
        if (this.closePrices.length >= this.period!) {
            const result = BollingerBands.calculate({
                period: this.period!,
                stdDev: this.mult,
                values: this.closePrices,
            });
            const last = result[result.length - 1]
            this.values.push({
                middle: last.middle,
                upper: last.upper,
                lower: last.lower
            });
        }
    }
}