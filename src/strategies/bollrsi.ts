import { MultiValue, SingleValue } from '../indicator/base-indicator';
import { BollingerIndicator } from '../indicator/bollinger-indicator';
import { RSIIndicator } from '../indicator/rsi-indicator';
import { getTime } from '../utils/helper';
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

  protected override onPrice(price: number, timestamp: number): void {
    const pos = this.broker!.getPosition()
    if (pos) {
      if (pos.size > 0) {
        // if (price >= pos.entryPrice * 1.02) {
        //   this.sell({ price: price, amount: pos.size, timestamp })
        // } else 
        if (price <= pos.entryPrice * 0.99) {
          this.sell({ price: price, amount: pos.size, timestamp })
        }
      } else if (pos.size < 0) {
        // if (price <= pos.entryPrice * 0.98) {
        //   this.buy({ price: price, amount: Math.abs(pos.size), timestamp })
        // } else 
        if (price >= pos.entryPrice * 1.01) {
          this.buy({ price: price, amount: Math.abs(pos.size), timestamp })
        }
      }
    }
  }

  override update(data: KlineData): void {
    const close = data.candle.close;

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
        if (close >= bollLast.middle) {// || (rsiLast >= 45 && rsiLast <= 55)
          this.sell({ price: close, amount: Math.abs(position), timestamp: data.candle.timestamp })
        }
      } else if (position < 0) {
        if (close <= bollLast.middle) {
          this.buy({ price: close, amount: Math.abs(position), timestamp: data.candle.timestamp })
        }
      } else {
        if (close >= bollLast.upper && rsiLast > 70) {
          // console.error("sell:", getTime(data.candle.timestamp), close, bollLast.upper, rsiLast)
          this.sell({ price: close, amount: 0.001, timestamp: data.candle.timestamp })
        } else if (close <= bollLast.lower && rsiLast < 30) {
          // console.error("buy:", getTime(data.candle.timestamp), close, bollLast.lower, rsiLast)
          this.buy({ price: close, amount: 0.001, timestamp: data.candle.timestamp })
        }
      }
    }
  }
}
