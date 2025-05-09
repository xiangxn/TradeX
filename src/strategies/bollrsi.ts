import { MultiValue, SingleValue } from '../indicator/base-indicator';
import { BollingerIndicator } from '../indicator/bollinger-indicator';
import { RSIIndicator } from '../indicator/rsi-indicator';
import { KlineData } from '../utils/types';
import { BaseStrategy } from './base-strategy';

export class BOLLRSI extends BaseStrategy {

  constructor(bollPeriod: number = 20, bollMult: number = 2, rsiPeriod: number = 14) {
    super({
      indicators: [
        new BollingerIndicator(bollPeriod, bollMult),
        new RSIIndicator(rsiPeriod)
      ]
    });
  }

  override update(data: KlineData): void {
    const close = data.candle.close;
    // console.debug("onCandle:", data)

    const rsiValues = this.getIndicator<SingleValue>("RSI");
    const boolValues = this.getIndicator<MultiValue>("BOLL");
    const bollLast = boolValues[boolValues.length - 1];
    const rsiLast = rsiValues[rsiValues.length - 1];

    if (bollLast && rsiLast) {
      console.debug(`[BollingerStrategy] Close: ${close.toFixed(2)} | MA: ${bollLast.middle!.toFixed(2)} | Upper: ${bollLast.upper!.toFixed(2)} | Lower: ${bollLast.lower!.toFixed(2)} RSI: ${rsiLast}`);

      let position = 0;
      let entryPrice = 0;
      const pos = this.broker!.getPosition()
      if (pos) {
        position = pos.size;
        entryPrice = pos.entryPrice;
      }
      if (position > 0) {
        // if (close >= entryPrice * 1.02) {
        //   this.sell({ price: close, amount: Math.abs(position), timestamp: data.candle.timestamp })
        // } else if (close <= entryPrice * 0.99) {
        //   this.sell({ price: close, amount: Math.abs(position), timestamp: data.candle.timestamp })
        // } else 
        if (close >= bollLast.middle) {// || (rsiLast >= 45 && rsiLast <= 55)
          this.sell({ price: close, amount: Math.abs(position), timestamp: data.candle.timestamp })
        }
      } else if (position < 0) {
        // if (close <= entryPrice * 0.98) {
        //   this.buy({ price: close, amount: Math.abs(position), timestamp: data.candle.timestamp })
        // } else if (close >= entryPrice * 0.01) {
        //   this.buy({ price: close, amount: Math.abs(position), timestamp: data.candle.timestamp })
        // } else 
        if (close <= bollLast.middle) {
          this.buy({ price: close, amount: Math.abs(position), timestamp: data.candle.timestamp })
        }
      } else {
        if (close >= bollLast.upper && rsiLast > 70) {
          this.sell({ price: close, amount: 0.0005, timestamp: data.candle.timestamp })
        } else if (close <= bollLast.lower && rsiLast < 30) {
          this.buy({ price: close, amount: 0.0005, timestamp: data.candle.timestamp })
        }
      }
    }
  }
}
