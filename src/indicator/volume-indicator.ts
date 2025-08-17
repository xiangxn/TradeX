import { SMA } from "technicalindicators";
import { Candle } from "../utils/types";
import { Indicator, IndicatorValue } from "./base-indicator";

export class MAVolumeIndicator implements Indicator {
    name: string;
    period?: number | undefined;
    values: IndicatorValue[];
    sma: SMA;
    isDraw: boolean;

    constructor(period: number = 14, name: string = "MAVolume") {
        this.isDraw = false
        this.name = name;
        this.period = period;
        this.values = [];
        this.sma = new SMA({ period: this.period, values: [] });
    }

    minPeriods() {
        return this.period!;
    }

    update(candle: Candle) {
        const result = this.sma.nextValue(candle.volume);
        if (result) {
            this.values.push(result);
        }
        return result;
    }
}