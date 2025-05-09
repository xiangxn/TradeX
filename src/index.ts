import "./utils/console"
import { Engine } from './core/engine';
import { MockBroker } from './broker/mock-broker';
import { BOLLRSI } from './strategies/bollrsi';
import { CCXTFeed } from './feed/ccxt-feed';
import { BacktestFeed } from "./feed/backtest-feed";
import { Statistics } from "./core/statistics";
import { PercentCommission } from "./commission/percent-commission";

// const engine = new Engine({
//   feed: [CCXTFeed, 'binance', 'BTC/USDT', '1m'],
//   broker: [MockBroker, 300],
//   strategies: [[BOLLRSI]],
// });


const engine = new Engine({
  feed: [BacktestFeed, 'BTC/USDT', '1h', '/Users/necklace/Downloads/BTCUSDT-1h-2025-02.csv'],
  statistics: [Statistics, "USDT"],
  broker: [MockBroker, { "BTC": 1, "USDT": 10000 }, new PercentCommission(0.001)],
  strategies: [[BOLLRSI]],
});

engine.backtest();
