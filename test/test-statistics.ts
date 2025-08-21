import { generateReport } from "../src/report/reporter";
import { DBStatistics } from "../src/statistics/db-statistics";

const report = DBStatistics.generateReportFromDB("ETH/USDT", "1h", "/Users/necklace/work/trader/data", "2025-01-01 00:00", "2025-08-02 00:00")

generateReport(report);