import { ADX } from "technicalindicators";
import { Candle } from "../utils/types";
import { Indicator, IndicatorValue } from "./base-indicator";

export class ADXIndicator implements Indicator {
    name: string;
    period?: number | undefined;
    values: IndicatorValue[];
    adx: ADX
    isDraw: boolean

    constructor(period: number = 14, name: string = "ADX", isDraw: boolean = true) {
        this.isDraw = isDraw
        this.name = name;
        this.period = period;
        this.values = [];
        this.adx = new ADX({ period: this.period, high: [], low: [], close: [] });
    }
    minPeriods() {
        return this.period! * 2 - 1;
    }

    update(candle: Candle) {
        // @ts-ignore
        const result = this.adx.nextValue({ high: candle.high, low: candle.low, close: candle.close, period: this.period });
        if (result) {
            this.values.push(
                {
                    adx: result.adx,
                    pdi: result.pdi,
                    mdi: result.mdi
                }
            );
        }
        return result
    }

}