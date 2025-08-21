import { Statistics } from "./base-statistics";
import Database from "better-sqlite3"
import fs from "fs";
import { Balances, IndicatorValue, KlineData, Order } from "../utils/types";
import { getTime } from "../utils/helper";

const INSERT_TRADES = "INSERT INTO trades (symbol,timeframe,time,price,fees,side,profit) VALUES (?,?,?,?,?,?,?)"
const INSERT_LINES = "INSERT INTO lines (symbol,timeframe,time,open,close,low,high,volume) VALUES (?,?,?,?,?,?,?,?)"
const INSERT_BALANCES = "INSERT INTO balances (symbol,timeframe,time,value) VALUES (?,?,?,?)"
const INSERT_INDICATORS = "INSERT INTO indicators (symbol,timeframe,time,name,value) VALUES (?,?,?,?,?)"

export class DBStatistics extends Statistics {

    protected db: Database.Database | null = null;
    protected dbDir: string;

    constructor(engine: any, dbDir: string | null = null) {
        super(engine);
        if (dbDir === null) {
            this.dbDir = process.cwd()
        } else {
            this.dbDir = dbDir
        }
        this.createTables()
    }

    public createTables() {
        const path = `${this.dbDir}/data/${this.engine.getSymbol().replace("/", "")}_${this.engine.getTimeframe()}.sqlite`
        console.debug("[Statistics] DB Path:", path)
        if (fs.existsSync(path)) {
            return
        }
        this.db = new Database(path)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS trades (
                id INTEGER PRIMARY KEY,
                symbol TEXT,
                timeframe TEXT,
                time TEXT,
                price REAL,
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
                order.symbol, timeframe, getTime(order.timestamp), order.price, fee, order.side, 0
            )
        }
    }

    protected override onPositionClose(order: Order): number {
        const profit = super.onPositionClose(order)
        if (this.db) {
            const fee = order.fee ? order.fee : 0;
            const timeframe = this.engine.getTimeframe()
            this.db.prepare(INSERT_TRADES).run(
                order.symbol, timeframe, getTime(order.timestamp), order.price, fee, order.side, profit
            )
        }
        return profit
    }

    protected override onBalanceUpdate(timestamp: number, balances: Balances) {
        super.onBalanceUpdate(timestamp, balances)
        if (this.db) {
            this.db.prepare(INSERT_BALANCES).run(
                `${this.base!}/${this.quote!}`, this.engine.getTimeframe(), getTime(timestamp), JSON.stringify(balances)
            )
        }
    }
}