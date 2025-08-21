import { Candle, IndicatorValue } from "../utils/types";



export interface Indicator {
    name: string;
    period?: number;
    isDraw: boolean;
    values: IndicatorValue[];
    update: (candle: Candle) => any;
    minPeriods: () => number;
}



