import { Commission } from '../commission/base-commission';
import { eventBus } from '../core/event-bus';
import { Balances, Order, Position } from '../utils/types';

export abstract class BaseBroker {
  protected balances: Balances = {};
  protected positions: Position[] = [];
  protected commission?: Commission;

  constructor(balances: Balances, commission?: Commission) {
    this.balances = balances
    this.commission = commission

    eventBus.on('signal:buy', async ({ price, amount, timestamp }) => {
      try {
        const result = await this.buyWithCommission(price, amount, timestamp);
        this.emitEvent(result);
      } catch (e: any) {
        console.error("broker buy error:", e)
      }
    });

    eventBus.on('signal:sell', async ({ price, amount, timestamp }) => {
      try {
        const result = await this.sellWithCommission(price, amount, timestamp);
        this.emitEvent(result);
      } catch (e: any) {
        console.error("broker sell error:", e)
      }
    });
  }

  protected emitEvent(order: Order) {
    const baseSymbol = this.getBaseSymbol(order.symbol)
    const position = this.getPosition(baseSymbol);
    if (position) {
      if (position.size !== 0) {
        eventBus.emit("order:filled", order);
      } else {
        eventBus.emit("position:closed", order);
        this.delPosition(baseSymbol);
      }
    }
    this.fetchBalances().then(balances => {
      eventBus.emit("balance:update", order.timestamp, balances);
    });
  }

  abstract buy(price: number, amount: number, timestamp: number): Promise<Order>;
  abstract sell(price: number, amount: number, timestamp: number): Promise<Order>;
  abstract fetchBalances(): Promise<Balances>;

  public getBalance(symbol: string): number {
    return this.balances[symbol] ?? 0;
  }

  public getPosition(symbol?: string): Position | undefined {
    if (!symbol) symbol = this.positions[0].symbol;
    return this.positions.find(p => p.symbol === symbol);
  }

  public addPosition(symbol: string, size: number, entryPrice: number) {
    const p = this.getPosition(symbol);
    if (p) {
      p.symbol = symbol;
      p.size += size;
      p.entryPrice = entryPrice;
    } else {
      this.positions.push({ symbol, size, entryPrice });
    }
  }

  protected delPosition(symbol: string) {
    const index = this.positions.findIndex((p) => p.symbol === symbol);
    if (index > -1) {
      this.positions.splice(index, 1);
    }
  }

  public async init(): Promise<void> {
    eventBus.emit("balance:init", this.balances)
  }

  private async buyWithCommission(price: number, amount: number, timestamp: number): Promise<Order> {
    if (this.commission) {
      const fee = this.commission.calculate(price, amount);
      const order = await this.buy(price, amount, timestamp);
      order.fee = fee;

      // 更新 quote balance（例如 USD）
      const quoteSymbol = this.getQuoteSymbol(order.symbol); // 比如 BTC/USD → USD
      this.subBalance(quoteSymbol, fee);
      return order;
    } else {
      return await this.buy(price, amount, timestamp);
    }
  }

  private async sellWithCommission(price: number, amount: number, timestamp: number): Promise<Order> {
    if (this.commission) {
      const fee = this.commission.calculate(price, amount);
      const order = await this.sell(price, amount, timestamp);
      order.fee = fee;

      // 更新 quote balance
      const quoteSymbol = this.getQuoteSymbol(order.symbol);
      this.subBalance(quoteSymbol, fee);
      return order;
    } else {
      return await this.sell(price, amount, timestamp);
    }

  }

  protected getQuoteSymbol(symbol: string): string {
    const parts = symbol.split('/');
    return parts[1]; // 比如 BTC/USD → USD
  }

  protected getBaseSymbol(symbol: string): string {
    const parts = symbol.split('/');
    return parts[0]; // 比如 BTC/USD → BTC
  }

  protected addBalance(symbol: string, amount: number) {
    this.balances[symbol] = (this.balances[symbol] ?? 0) + Math.abs(amount);
  }

  protected subBalance(symbol: string, amount: number) {
    let balance = this.balances[symbol] ?? 0;
    let absamount = Math.abs(amount)
    if (balance >= absamount) {
      this.balances[symbol] -= absamount;
    } else {
      throw new Error(`Insufficient balance: ${symbol}:${amount}`);
    }
  }

}
