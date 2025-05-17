import { Candle } from "../utils/types";

export type SingleValue = number;
export type MultiValue = Record<string, number>;
export type IndicatorValue = SingleValue | MultiValue;

export interface Indicator {
    name: string;
    period?: number;
    values: IndicatorValue[];
    update: (candle: Candle) => any;
    minPeriods: () => number;
}



