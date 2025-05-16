import { ADX } from "technicalindicators";
import { Candle } from "../utils/types";
import { Indicator, IndicatorValue } from "./base-indicator";

export class ADXIndicator implements Indicator {
    name: string;
    period?: number | undefined;
    values: IndicatorValue[];
    adx: ADX

    constructor(period: number = 14, name: string = "ADX") {
        this.name = name;
        this.period = period;
        this.values = [];
        this.adx = new ADX({ period: this.period, high: [], low: [], close: [] });
    }
    
    update(candle: Candle) {
        const result = this.adx.nextValue(candle.close);
        if (result) {
            this.values.push(
                {
                    adx: result.adx,
                    pdi: result.pdi,
                    mdi: result.mdi
                }
            );
        }
    }

}