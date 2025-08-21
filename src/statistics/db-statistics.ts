import { Statistics } from "./base-statistics";
import Database from "better-sqlite3"
import fs from "fs";
import { Balances, DataStats, IndicatorValue, KlineData, Line, Order, Trade } from "../utils/types";
import { calculateSharpe, getTime } from "../utils/helper";

const INSERT_TRADES = "INSERT INTO trades (symbol,timeframe,time,price,amount,fees,side,profit) VALUES (?,?,?,?,?,?,?,?)"
const INSERT_LINES = "INSERT INTO lines (symbol,timeframe,time,open,close,low,high,volume) VALUES (?,?,?,?,?,?,?,?)"
const INSERT_BALANCES = "INSERT INTO balances (symbol,timeframe,time,value) VALUES (?,?,?,?)"
const INSERT_INDICATORS = "INSERT INTO indicators (symbol,timeframe,time,name,value) VALUES (?,?,?,?,?)"

export class DBStatistics extends Statistics {

    protected db: Database.Database | null = null;
    protected dbDir: string;

    constructor(engine: any, dbDir: string | null = null, symbol: string | null = null, timeframe: string | null = null) {
        super(engine);
        if (dbDir === null) {
            this.dbDir = `${process.cwd()}/data`
        } else {
            this.dbDir = dbDir
        }
        if (symbol === null && this.engine != null) {
            this.symbol = this.engine.getSymbol()
            this.base = this.symbol!.split("/")[0]
            this.quote = this.symbol!.split("/")[1]
            symbol = this.symbol!.replace("/", "")
        } else {
            this.symbol = symbol!
            symbol = symbol!.replace("/", "")
            this.base = this.symbol.split("/")[0]
            this.quote = this.symbol.split("/")[1]
        }
        if (timeframe === null && engine != null) {
            timeframe = this.engine.getTimeframe()
        }
        this.createTables(symbol!, timeframe!)
    }

    public createTables(symbol: string, timeframe: string) {
        const path = `${this.dbDir}/${symbol}_${timeframe}.sqlite`
        console.debug("[Statistics] DB Path:", path)
        if (fs.existsSync(path)) {
            this.db = new Database(path)
            return
        } else {
            this.db = new Database(path)
        }
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS trades (
                id INTEGER PRIMARY KEY,
                symbol TEXT,
                timeframe TEXT,
                time TEXT,
                price REAL,
                amount REAL,
                fees REAL,
                side TEXT,
                profit REAL
            );
            CREATE INDEX IF NOT EXISTS idx_trades_symbol_timeframe ON trades(symbol, timeframe);

            CREATE TABLE IF NOT EXISTS lines (
                id INTEGER PRIMARY KEY,
                symbol TEXT,
                timeframe TEXT,
                time TEXT,
                open REAL,
                close REAL,
                low REAL,
                high REAL,
                volume REAL
            );
            CREATE INDEX IF NOT EXISTS idx_lines_symbol_timeframe ON trades(symbol, timeframe);

            CREATE TABLE IF NOT EXISTS balances (
                id INTEGER PRIMARY KEY,
                symbol TEXT,
                timeframe TEXT,
                time TEXT,
                value TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_balances_symbol_timeframe ON balances(symbol, timeframe);

            CREATE TABLE IF NOT EXISTS indicators (
                id INTEGER PRIMARY KEY,
                symbol TEXT,
                timeframe TEXT,
                time TEXT,
                name TEXT,
                value TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_indicators_symbol_timeframe ON indicators(symbol, timeframe);
        `)
    }

    protected override onCandle(data: { kline: KlineData, indicators: { [key: string]: IndicatorValue } }) {
        super.onCandle(data)
        const kline = data.kline
        if (this.db) {
            let insKline = this.db.prepare(INSERT_LINES)
            let insInd = this.db.prepare(INSERT_INDICATORS)
            this.db.transaction(() => {
                insKline.run(kline.symbol, this.engine.getTimeframe(), getTime(kline.candle.timestamp), kline.candle.open, kline.candle.close, kline.candle.low, kline.candle.high, kline.candle.volume)
                for (const [name, value] of Object.entries(data.indicators)) {
                    insInd.run(kline.symbol, this.engine.getTimeframe(), getTime(kline.candle.timestamp), name, JSON.stringify(value))
                }
            })()
        }
    }

    protected override onFill(order: Order): void {
        super.onFill(order)
        if (this.db) {
            const fee = order.fee ? order.fee : 0;
            const timeframe = this.engine.getTimeframe()
            this.db.prepare(INSERT_TRADES).run(
                order.symbol, timeframe, getTime(order.timestamp), order.price, order.amount, fee, order.side, 0
            )
        }
    }

    protected override onPositionClose(order: Order): number {
        const isSave = this.lastOrder !== null
        const profit = super.onPositionClose(order)
        if (this.db) {
            const fee = isSave ? (order.fee ? order.fee : 0) : 0;
            const timeframe = this.engine.getTimeframe()
            this.db.prepare(INSERT_TRADES).run(
                order.symbol, timeframe, getTime(order.timestamp), order.price, order.amount, fee, order.side, profit
            )
        }
        return profit
    }

    protected override onBalanceInit(balances: Balances) {
        super.onBalanceInit(balances)
        if (this.db) {
            this.db.prepare(INSERT_BALANCES).run(
                `${this.base!}/${this.quote!}`, this.engine.getTimeframe(), "0", JSON.stringify(balances)
            )
        }
    }

    protected override onBalanceUpdate(timestamp: number, balances: Balances) {
        super.onBalanceUpdate(timestamp, balances)
        if (this.db) {
            this.db.prepare(INSERT_BALANCES).run(
                `${this.base!}/${this.quote!}`, this.engine.getTimeframe(), getTime(timestamp), JSON.stringify(balances)
            )
        }
    }

    public static generateReportFromDB(symbol: string, timeframe: string, dbDir: string, startTime: string, endTime: string): DataStats {
        const stat = new DBStatistics(null, dbDir, symbol, timeframe)
        const balances = stat.getBalancesFromDB(symbol, timeframe, startTime, endTime)
        stat.initialBalance = balances.slice(0)[0].value
        stat.finalBalance = balances.slice(-1)[0].value
        stat.equityCurve = balances

        const trades = stat.getTradesFromDB(symbol, timeframe, startTime, endTime)
        stat.trades = trades.map(trade => ({ time: trade.time, price: trade.price, side: trade.side } as Trade))
        stat.lines = stat.getLinesFromDB(symbol, timeframe, startTime, endTime).map((line: any) => ({
            time: line.time,
            open: line.open,
            close: line.close,
            low: line.low,
            high: line.high,
            volume: line.volume,
            buy: false,
            sell: false,
            equity: {},
            price: line.close
        } as Line))
        stat.profits = trades.filter(trade => trade.profit !== 0).map(trade => trade.profit)
        stat.fees = trades.map(trade => trade.fees).reduce((a, b) => a + b, 0)

        // 合并交易数据
        for (const trade of stat.trades) {
            const index = stat.lines.findIndex((v) => v.time === trade.time);
            if (index > -1) {
                stat.lines[index].price = trade.price;
                if (trade.side === 'buy') {
                    stat.lines[index].buy = true;
                } else {
                    stat.lines[index].sell = true;
                }
            }
        }
        // 合并余额数据
        stat.equityCurve[0].time = stat.lines[0].time;
        let equity = {}
        for (const l of stat.lines) {
            const index = stat.equityCurve.findIndex((v) => v.time === l.time);
            if (index > -1) {
                equity = { ...stat.equityCurve[index].value }
            }
            l.equity = { ...equity }
        }
        // 合并指标数据
        const indicators = stat.getIndicatorsFromDB(symbol, timeframe, startTime, endTime)
        for (const l of stat.lines) {
            const ins = indicators[l.time]
            Object.entries(ins).forEach(([name, value]) => {
                const val = value as string
                if (val.startsWith("{")) {
                    Object.entries(JSON.parse(val)).forEach(([k, v]) => {
                        l[`${name.toUpperCase()}_${k.toUpperCase()}`] = v
                    })
                } else {
                    l[name.toUpperCase()] = JSON.parse(val)
                }
            })
        }

        const winTrades = stat.profits.filter((v) => v > 0);
        const loseTrades = stat.profits.filter((v) => v < 0);
        const grossProfit = winTrades.reduce((a, b) => a + b, 0)
        const grossLoss = loseTrades.reduce((a, b) => Math.abs(a) + Math.abs(b), 0)

        const averageProfit = grossProfit / winTrades.length
        const averageLoss = grossLoss / loseTrades.length

        const winRate = stat.profits.length > 0 ? winTrades.length / stat.profits.length : 0

        const start = new Date(stat.lines[0].time)
        const end = new Date(stat.lines[stat.lines.length - 1].time)
        const time = ((end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())) / 12
        const sharpeRatio = calculateSharpe(stat.profits, stat.profits.length / time)

        return {
            initialBalance: stat.initialBalance,
            finalBalance: stat.finalBalance,
            winTrades: winTrades.length,
            loseTrades: loseTrades.length,
            averageProfit,
            averageLoss,
            riskRewardRatio: averageProfit / averageLoss,
            profitFactor: grossProfit / grossLoss,
            winRate,
            maxDrawdown: stat.caclMaxDrawdown(),
            sharpeRatio,
            fees: stat.fees,
            lines: stat.lines
        } as DataStats
    }

    public getBalancesFromDB(symbol: string, timeframe: string, startTime: string, endTime: string): any[] {
        const rows = this.db?.prepare(`SELECT * FROM balances WHERE symbol = ? AND timeframe = ? AND (time == '0' OR (time >= ? AND time <= ?)) ORDER BY time`).all(symbol, timeframe, startTime, endTime)
        return rows?.map((row: any) => ({
            time: row.time,
            value: JSON.parse(row.value)
        })) || []
    }

    public getTradesFromDB(symbol: string, timeframe: string, startTime: string, endTime: string): any[] {
        return this.db?.prepare(`SELECT * FROM trades WHERE symbol = ? AND timeframe = ? AND (time >= ? AND time <= ?) ORDER BY time`).all(symbol, timeframe, startTime, endTime) || []
    }

    public getLinesFromDB(symbol: string, timeframe: string, startTime: string, endTime: string): any[] {
        return this.db?.prepare(`SELECT * FROM lines WHERE symbol = ? AND timeframe = ? AND (time >= ? AND time <= ?) ORDER BY time`).all(symbol, timeframe, startTime, endTime) || []
    }

    public getIndicatorsFromDB(symbol: string, timeframe: string, startTime: string, endTime: string): any {
        const rows = this.db?.prepare(`SELECT * FROM indicators WHERE symbol = ? AND timeframe = ? AND (time >= ? AND time <= ?) ORDER BY time`).all(symbol, timeframe, startTime, endTime) || []
        return rows.reduce<Record<string, any>>((acc, row: any) => {
            if (!acc[row.time]) {
                acc[row.time] = {};
            }
            acc[row.time][row.name] = row.value;
            return acc;
        }, {})
    }
}