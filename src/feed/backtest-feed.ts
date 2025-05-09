import { Candle } from '../utils/types';
import { BaseFeed } from './base-feed';
import fs from 'fs'
import { parse } from 'csv-parse';

const fieldNames = ['timestamp', 'open', 'high', 'low', 'close', 'volume'];


export class BacktestFeed extends BaseFeed {
    csvPath: string

    constructor(symbol: string, timeframe: string, csvPath: string) {
        super(null, symbol, timeframe);
        this.csvPath = csvPath;
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

    async run() {
        for (const candle of this.data) {
            if (candle.timestamp !== this.lastTimestamp) {
                this.lastTimestamp = candle.timestamp;
                this.emitCandle({ symbol: this.symbol, timeframe: this.timeframe, candle });
            }
            if (candle.close !== this.lastPrice) {
                this.lastPrice = candle.close;
                this.emitPrice(this.lastPrice);
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
        return this.data.splice(0, limit)
    }
}
