import "./utils/console"
import { Engine } from './core/engine';
import { MockBroker } from './broker/mock-broker';
import { BOLLRSI2 } from './strategies/bollrsi2';
import { BOLLRSI } from './strategies/bollrsi';
import { CCXTFeed } from './feed/ccxt-feed';
import { BacktestFeed } from "./feed/backtest-feed";
import { Statistics } from "./statistics/base-statistics";
import { PercentCommission } from "./commission/percent-commission";
import { BollBreak } from "./strategies/BollBreak";
import { BollADXRSI } from "./strategies/BollAdxRsi";
import { BollATR } from "./strategies/BollATR";
import { Polymeric } from "./strategies/Polymeric";
import { DBStatistics } from "./statistics/db-statistics";

// const engine = new Engine({
//   feed: [CCXTFeed, 'binance', 'BTC/USDT', '1m'],
//   broker: [MockBroker, 300],
//   strategies: [[BOLLRSI]],
// });


const engine = new Engine({
  feed: [BacktestFeed, 'ETH/USDT', '1h', './test/merged_ETHUSDT_1h_2023-2024.csv','8h'],
  // feed: [BacktestFeed, 'ETH/USDT', '5m', '/Users/necklace/Downloads/ETHUSDT-5m-2025-01.csv','1h'],
  statistics: [Statistics],
  broker: [MockBroker, { "ETH": 0.2, "USDT": 1000 }, new PercentCommission(0.001)],
  strategies: [[Polymeric]],
});

engine.backtest();
