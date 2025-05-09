import { Commission } from "./base-commission";

export class PercentCommission implements Commission {
    constructor(private rate: number) { }  // rate 例如 0.001 表示 0.1%

    calculate(price: number, amount: number): number {
        return amount * price * this.rate;
    }
}
