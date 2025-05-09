import { BaseBroker } from './base-broker';
import { Balances, Order, Position } from '../utils/types';
import { Commission } from '../commission/base-commission';

export class MockBroker extends BaseBroker {
  private base: string;
  private quote: string;

  constructor(balances: { [symbol: string]: number }, commission: Commission) {
    const bs: Balances = {};
    const base = Object.keys(balances)[0];
    const quote = Object.keys(balances)[1];
    bs[base] = Object.values(balances)[0];
    bs[quote] = Object.values(balances)[1];
    super(bs, commission);
    this.base = base;
    this.quote = quote;
  }

  public override getPosition(symbol?: string): Position | undefined {
    if (!symbol) symbol = this.base;
    return super.getPosition(symbol);
  }

  public async buy(price: number, amount: number, timestamp: number): Promise<Order> {
    const cost = amount * price;
    if (this.getBalance(this.quote) < cost) throw new Error(`Insufficient balance ${this.quote}:${cost}`);

    this.subBalance(this.quote, cost);
    this.addBalance(this.base, amount);
    this.addPosition(this.base, amount, price);

    return {
      symbol: `${this.base}/${this.quote}`,
      side: 'buy',
      price: price,
      amount,
      cost,
      timestamp: timestamp
    };
  }

  public async sell(price: number, amount: number, timestamp: number): Promise<Order> {
    const balance = this.getBalance(this.base);
    if (balance < amount) throw new Error(`Insufficient balance ${this.base}:${amount}`)

    const proceeds = amount * price;
    this.addBalance(this.quote, proceeds);
    this.subBalance(this.base, amount);
    this.addPosition(this.base, -amount, price);

    return {
      symbol: `${this.base}/${this.quote}`,
      side: 'sell',
      price: price,
      amount,
      cost: proceeds,
      timestamp: timestamp
    };
  }

  public override async fetchBalances(): Promise<Balances> {
    return this.balances
  }
}
