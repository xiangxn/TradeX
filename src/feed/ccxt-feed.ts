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
          this.emitCandle({
            symbol: this.symbol, timeframe: this.timeframe,
            candle: {
              timestamp: last[0],
              open: last[1],
              high: last[2],
              low: last[3],
              close: last[4],
              volume: last[5]
            }
          });
        }
        if (last[4] !== this.lastPrice) {
          this.lastPrice = last[4];
          this.emitPrice(this.lastPrice, last[0]);
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
    const data = await exchange.fetchOHLCV(symbol, timeframe, undefined, limit);
    return data.map((candle: any) => ({
      timestamp: candle[0],
      open: candle[1],
      high: candle[2],
      low: candle[3],
      close: candle[4],
      volume: candle[5]
    }))
  }
}