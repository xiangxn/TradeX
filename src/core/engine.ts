import { BaseBroker } from '../broker/base-broker';
import { BaseStrategy } from '../strategies/base-strategy';
import { generateReport } from '../report/reporter';
import { Statistics } from './statistics';
import { BaseFeed } from '../feed/base-feed';

type ClassWithArgs<T> = [new (...args: any[]) => T, ...any[]];

export interface EngineOptions<
  TBroker extends BaseBroker,
  TStrategy extends BaseStrategy,
  TFeed extends BaseFeed,
  TStatistics extends Statistics
> {
  feed: ClassWithArgs<TFeed>;
  broker: ClassWithArgs<TBroker>;
  strategies: ClassWithArgs<TStrategy>[];
  statistics: ClassWithArgs<TStatistics>;
  [key: string]: any;
}

export class Engine<
  TBroker extends BaseBroker,
  TStrategy extends BaseStrategy,
  TFeed extends BaseFeed,
  TStatistics extends Statistics
> {
  private feed: TFeed;
  private broker: TBroker;
  private strategies: TStrategy[];
  private statistics: Statistics;

  constructor(private options: EngineOptions<TBroker, TStrategy, TFeed, TStatistics>) {
    const { feed, broker, statistics } = this.options

    const [statisticsClass, ...statisticsArgs] = statistics;
    this.statistics = new statisticsClass(this, ...statisticsArgs);

    const [BrokerClass, ...brokerArgs] = broker
    this.broker = new BrokerClass(...brokerArgs)

    const [FeedClass, ...feedArgs] = feed
    this.feed = new FeedClass(...feedArgs)

    this.strategies = this.options.strategies.map(([StrategyClass, ...args]) => new StrategyClass(...args))
  }

  public getStrategies() {
    return this.strategies;
  }

  public addStrategy(strategy: ClassWithArgs<TStrategy>) {
    const [StrategyClass, ...args] = strategy
    this.strategies.push(new StrategyClass(...args))
  }

  async start() {
    console.info('[Engine] Starting live feed...')
    await this.broker.init()
    await this.feed.init()
    for (const s of this.strategies) await s.init(this.broker, this.feed);
    await this.feed.run()
  }

  /**
   * 回测
   * 只会绘制第一个策略的统计图
   */
  async backtest() {
    console.info('[Engine] Starting backtest...')
    await this.broker.init()
    await this.feed.init()
    for (const s of this.strategies) await s.init(this.broker, this.feed);
    await this.feed.run()
    await generateReport(this.statistics.generateReport());
  }
}
