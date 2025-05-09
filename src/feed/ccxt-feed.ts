import ccxt from 'ccxt';
import { Candle } from '../utils/types';
import { BaseFeed } from './base-feed';

export class CCXTFeed extends BaseFeed {

  constructor(exchangeId: string, symbol: string, timeframe: string = '1m') {
    super(exchangeId, symbol, timeframe);
  }

  async run() {
    this.isRun = true
    while (this.isRun) {
      try {
        const ohlcv = await this.exchange.watchOHLCV(this.symbol, this.timeframe);
        const last = ohlcv[ohlcv.length - 1];
        if (last[0] !== this.lastTimestamp) {
          this.lastTimestamp = last[0];
          this.emitCandle({ symbol: this.symbol, timeframe: this.timeframe, candle: last });
        }
        if (last[4] !== this.lastPrice) {
          this.lastPrice = last[4];
          this.emitPrice(this.lastPrice);
        }
      } catch (err) {
        console.error('[CCXTFeed] Error:', err);
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }

  override async fetchHistoricalOHLCV(
    exchangeId: string,
    symbol: string,
    timeframe: string,
    limit: number
  ): Promise<Candle[]> {
    // @ts-ignore
    const exchange = new ccxt[exchangeId]();
    await exchange.loadMarkets();
    return await exchange.fetchOHLCV(symbol, timeframe, undefined, limit);
  }
}