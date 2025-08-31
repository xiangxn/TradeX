// @file:test/download.ts
/**
 * 用 curl + unzipper + fs-extra 下载 Binance ETHUSDT 1h 月度K线，
 * 解压并合并为单一 CSV 文件。
 */

import fs from "fs-extra";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import * as unzipper from "unzipper";

const execFileAsync = promisify(execFile);

const BASE =
  "https://data.binance.vision/data/futures/um/monthly/klines/ETHUSDT/1h";

const CSV_HEADER =
  "open_time,open,high,low,close,volume,close_time,quote_volume,count,taker_buy_volume,taker_buy_quote_volume,ignore";

const ROOT = path.resolve(__dirname);
const WORKDIR = path.join(ROOT, ".ethusdt_1h_work");
const ZIP_DIR = path.join(WORKDIR, "zip");
const EXTRACT_DIR = path.join(WORKDIR, "extracted");
const OUTPUT_CSV = path.join(ROOT, "merged_ETHUSDT_1h_2023-2024.csv");

// 生成 YYYY-MM 列表（含起止）
function listMonths(from: string, to: string): string[] {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  const out: string[] = [];
  let y = fy,
    m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${m.toString().padStart(2, "0")}`);
    m++;
    if (m === 13) {
      m = 1;
      y++;
    }
  }
  return out;
}

// 用 curl 下载
async function downloadZip(ym: string): Promise<string> {
  await fs.ensureDir(ZIP_DIR);
  const zipPath = path.join(ZIP_DIR, `ETHUSDT-1h-${ym}.zip`);
  if (await fs.pathExists(zipPath)) {
    const st = await fs.stat(zipPath).catch(() => null);
    if (st && st.size > 0) {
      console.log(`[skip] ${ym} exists`);
      return zipPath;
    }
  }

  const url = `${BASE}/ETHUSDT-1h-${ym}.zip`;
  console.log(`[curl] Downloading ${url}...`);

  try {
    await execFileAsync("curl", ["-L", "-o", zipPath, url]);
  } catch (err) {
    console.warn(`[warn] curl failed for ${ym}: ${(err as Error).message}`);
    throw err;
  }

  return zipPath;
}

// 解压 zip 内的第一个 CSV 文件
async function unzipToCsv(zipPath: string): Promise<string> {
  await fs.ensureDir(EXTRACT_DIR);
  const directory = await unzipper.Open.file(zipPath);
  const csvEntry =
    directory.files.find((f) => f.path.endsWith(".csv")) ?? directory.files[0];

  if (!csvEntry) throw new Error(`No entries in zip: ${zipPath}`);

  const outCsv = path.join(EXTRACT_DIR, path.basename(csvEntry.path));
  await fs.ensureDir(path.dirname(outCsv));

  await new Promise<void>((resolve, reject) => {
    csvEntry
      .stream()
      .pipe(fs.createWriteStream(outCsv))
      .on("finish", () => resolve())
      .on("error", (e) => reject(e));
  });

  return outCsv;
}

// 合并所有 CSV，只写一次表头
async function mergeCsv(csvFiles: string[], outputCsv: string) {
  console.log(`[merge] -> ${outputCsv}`);
  await fs.ensureFile(outputCsv);
  const ws = fs.createWriteStream(outputCsv, { flags: "w" });
  ws.write(CSV_HEADER + "\n");

  for (const file of csvFiles) {
    const raw = await fs.readFile(file, "utf8");
    const lines = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

    let start = 0;
    if (lines[0] && lines[0].toLowerCase().startsWith("open_time")) start = 1;

    for (let i = start; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      ws.write(line + "\n");
    }
  }

  await new Promise<void>((resolve, reject) => {
    ws.end(() => resolve());
    ws.on("error", reject);
  });

  console.log(`[ok] merged ${csvFiles.length} files`);
}

async function main() {
  const months = listMonths("2023-01", "2024-12");

  await fs.emptyDir(WORKDIR);
  await fs.ensureDir(ZIP_DIR);
  await fs.ensureDir(EXTRACT_DIR);

  const csvPaths: string[] = [];

  for (const ym of months) {
    try {
      const zipPath = await downloadZip(ym);
      const csvPath = await unzipToCsv(zipPath);
      csvPaths.push(csvPath);
    } catch (err) {
      console.warn(`[warn] skipping ${ym}: ${(err as Error).message}`);
    }
  }

  if (csvPaths.length === 0) {
    console.error("No CSVs downloaded/extracted. Exiting.");
    process.exit(1);
  }

  await mergeCsv(csvPaths, OUTPUT_CSV);

  console.log("\n=== DONE ===");
  console.log(`Output CSV: ${OUTPUT_CSV}`);
  console.log(`Workdir kept: ${WORKDIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
