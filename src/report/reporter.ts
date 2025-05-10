import fs from 'fs';
import path from 'path';
import express from 'express';
import openurl from 'openurl';
import { DataStats } from '../utils/types';

const staticDir = path.join(__dirname, 'static');

export async function generateReport(data: DataStats) {
    
    const reportPath = path.join(staticDir, 'report.json');
    fs.writeFileSync(reportPath, JSON.stringify(data, null, 2));

    await showReport();
}

export async function showReport() {
    const app = express();
    app.use(express.static(staticDir));

    const port = 3000;
    const url = `http://localhost:${port}`;
    app.listen(port, () => {
        console.info(`[Reporter] Report available at ${url}`);
        openurl.open(url)
    });
}
