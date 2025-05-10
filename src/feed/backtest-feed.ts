import { Candle } from '../utils/types';
import { BaseFeed } from './base-feed';
import fs from 'fs'
import { parse } from 'csv-parse';
import { getAggregateMs, getTime } from '../utils/helper';

const fieldNames = ['timestamp', 'open', 'high', 'low', 'close', 'volume'];


export class BacktestFeed extends BaseFeed {
    csvPath: string
    aggregateTimeframe?: string
    aggregatedCandle: Candle | null = null
    aggregationStart: number = 0

    constructor(symbol: string, timeframe: string, csvPath: string, aggregateTimeframe?: string) {
        super(null, symbol, timeframe)
        this.csvPath = csvPath
        this.aggregateTimeframe = aggregateTimeframe
    }

    private readCsv(csvPath: string) {
        console.debug("Initializing data...")
        return new Promise((resolve, reject) => {
            fs.createReadStream(csvPath)
                .pipe(parse({
                    columns: (header) => fieldNames,
                    relax_column_count: true,
                    cast: true
                }))
                .on('data', (row: Candle) => {
                    switch (row.timestamp.toString().length) {
                        case 10:
                            this.data.push({ ...row, timestamp: row.timestamp * 1000 });
                            break;
                        case 16:
                            this.data.push({ ...row, timestamp: row.timestamp / 1000 });
                            break;
                        default:
                            this.data.push(row);
                            break;
                    }
                })
                .on('end', () => {
                    this.data.sort((a, b) => a.timestamp - b.timestamp);
                    console.log('Candle Data:', this.data.length);
                    resolve(true)
                })
                .on('error', (err) => {
                    console.error('Error reading CSV:', err);
                    reject(err)
                });
        })
    }

    public override async init(): Promise<void> {
        await this.readCsv(this.csvPath)
    }

    public override getTimeframe() {
        return !this.aggregateTimeframe ? this.timeframe : this.aggregateTimeframe
    }

    private aggregateCandle(candle: Candle) {
        const aggMs = getAggregateMs(this.aggregateTimeframe!)
        const time = Math.floor(candle.timestamp / aggMs) * aggMs

        if (!this.aggregatedCandle) {
            // 初始化第一段
            this.aggregationStart = time
            this.aggregatedCandle = { ...candle }
        } else if (time !== this.aggregationStart) {
            // 时间段结束，发出聚合 candle
            this.emitCandle({ symbol: this.symbol, timeframe: this.aggregateTimeframe!, candle: this.aggregatedCandle })

            // 开启新段
            this.aggregationStart = time
            this.aggregatedCandle = { ...candle }
        } else {
            // 继续累计当前段
            this.aggregatedCandle.high = Math.max(this.aggregatedCandle.high, candle.high)
            this.aggregatedCandle.low = Math.min(this.aggregatedCandle.low, candle.low)
            this.aggregatedCandle.close = candle.close
            this.aggregatedCandle.volume += candle.volume
        }
    }

    private aggregateCandles(candles: Candle[]): Candle[] {
        const newCandles: Candle[] = []
        let curent: Candle | null = null
        let start: number = 0
        const aggMs = getAggregateMs(this.aggregateTimeframe!)
        for (const candle of candles) {
            const time = Math.floor(candle.timestamp / aggMs) * aggMs
            if (!curent) {
                start = time
                curent = { ...candle }
            } else if (time != start) {
                newCandles.push({ ...curent })
                curent = null
                start = time
            } else {
                curent.high = Math.max(curent.high, candle.high)
                curent.low = Math.min(curent.low, candle.low)
                curent.close = candle.close
                curent.volume += candle.volume
            }
        }
        return newCandles
    }


    async run() {
        for (const candle of this.data) {
            if (candle.timestamp !== this.lastTimestamp) {
                this.lastTimestamp = candle.timestamp;
                if (this.aggregateTimeframe) {
                    this.aggregateCandle(candle)
                } else {
                    this.emitCandle({ symbol: this.symbol, timeframe: this.getTimeframe(), candle })
                }
            }
            if (candle.close !== this.lastPrice) {
                this.lastPrice = candle.close;
                this.emitPrice(this.lastPrice, candle.timestamp);
            }
            await new Promise(r => setTimeout(r, 5)); // 模拟一点延迟
        }
        console.info(`[BacktestFeed] ${this.symbol} ${this.timeframe} 回测结束`);
    }

    override async fetchHistoricalOHLCV(
        exchangeId: string | null,
        symbol: string,
        timeframe: string,
        limit: number
    ): Promise<Candle[]> {
        if (!this.aggregateTimeframe) {
            return this.data.splice(0, limit)
        } else {
            const count = getAggregateMs(this.aggregateTimeframe) / getAggregateMs(this.timeframe) * limit
            const candles = this.data.splice(0, count)
            return this.aggregateCandles(candles)
        }
    }
}
