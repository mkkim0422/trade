const fs = require('fs');
const path = require('path');
const readline = require('readline');

console.log('SKT 유동인구 데이터 전처리 시작 (합계 방식)\n');

const GANGNAM_DONGS = new Set([
  '11680101', '11680102', '11680103', '11680104', '11680105', '11680106',
  '11680107', '11680108', '11680109', '11680110', '11680111', '11680112',
  '11680113', '11680114', '11680115', '11680116', '11680117', '11680118',
  '11680119', '11680120', '11680121', '11680122',
]);

const SKT_FOLDER = 'C:/Users/User/OneDrive/바탕 화면/회사/00.연습/trade2/SKT';
const OUTPUT_PATH = path.join(
  'C:/Users/User/OneDrive/바탕 화면/회사/00.연습/trade2/public/data',
  'foottraffic.json'
);

const gridData = new Map();

function parseHeader(line) {
  return line.split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
}

function parseRow(line, headers) {
  const values = line.split(',');
  const row = {};
  for (let i = 0; i < headers.length; i++) {
    const v = values[i] || '';
    row[headers[i]] = v.trim().replace(/^"|"$/g, '');
  }
  return row;
}

async function processFile(filePath, fileLabel) {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath, { encoding: 'utf-8' }),
      crlfDelay: Infinity,
    });

    let headers = null;
    let lineCount = 0;
    let aggregatedCount = 0;
    let lastLogged = Date.now();

    rl.on('line', (line) => {
      if (!line) return;
      if (headers === null) {
        headers = parseHeader(line);
        return;
      }

      lineCount++;
      const row = parseRow(line, headers);

      if (!GANGNAM_DONGS.has(row.EMD_CD)) return;

      const gid = row.GID;
      if (!gid) return;

      const weekdayNm = row.WEEK_YN_NM;
      const pop = parseFloat(row.V_POP || '0');
      if (!isFinite(pop)) return;

      let entry = gridData.get(gid);
      if (!entry) {
        entry = {
          dong: row.EMD_KOR_NM,
          weekdaySum: 0,
          weekdayCount: 0,
          weekendSum: 0,
          weekendCount: 0,
        };
        gridData.set(gid, entry);
      }

      if (weekdayNm === '주중') {
        entry.weekdaySum += pop;
        entry.weekdayCount++;
      } else if (weekdayNm === '주말') {
        entry.weekendSum += pop;
        entry.weekendCount++;
      }

      aggregatedCount++;

      if (Date.now() - lastLogged > 5000) {
        console.log(
          `  ${fileLabel}: ${lineCount.toLocaleString()}행, 강남구 ${aggregatedCount.toLocaleString()}행 (격자 ${gridData.size}개)`
        );
        lastLogged = Date.now();
      }
    });

    rl.on('close', () => {
      console.log(
        `  -> 완료: ${lineCount.toLocaleString()}행 중 강남구 ${aggregatedCount.toLocaleString()}행`
      );
      resolve();
    });

    rl.on('error', reject);
  });
}

async function main() {
  if (!fs.existsSync(SKT_FOLDER)) {
    throw new Error(`SKT 폴더 없음: ${SKT_FOLDER}`);
  }

  const files = fs
    .readdirSync(SKT_FOLDER)
    .filter((f) => f.endsWith('.csv') && f.toUpperCase().startsWith('SKT_'))
    .sort();

  console.log(`처리할 파일: ${files.length}개\n`);

  const startedAt = Date.now();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const label = `[${i + 1}/${files.length}] ${file}`;
    console.log(`${label} 처리 중...`);
    await processFile(path.join(SKT_FOLDER, file), label);
  }

  const elapsedMin = ((Date.now() - startedAt) / 60000).toFixed(1);
  console.log(`\n전체 처리 완료 (${elapsedMin}분 소요), 격자 ${gridData.size}개\n`);

  const result = [];
  for (const [gid, entry] of gridData) {
    const weekdayDaily = entry.weekdayCount > 0
      ? (entry.weekdaySum / entry.weekdayCount) * 24
      : 0;
    const weekendDaily = entry.weekendCount > 0
      ? (entry.weekendSum / entry.weekendCount) * 24
      : 0;
    const dailyAvg = (weekdayDaily * 5 + weekendDaily * 2) / 7;

    if (dailyAvg <= 0) continue;

    result.push({
      gid,
      dong: entry.dong,
      weekdayAvg: Math.round(weekdayDaily),
      weekendAvg: Math.round(weekendDaily),
      dailyAvg: Math.round(dailyAvg),
    });
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2));

  const stat = fs.statSync(OUTPUT_PATH);
  const fileSizeKB = (stat.size / 1024).toFixed(1);
  console.log(`저장 완료: ${OUTPUT_PATH} (${fileSizeKB} KB, 격자 ${result.length}개)\n`);

  if (result.length === 0) return;

  const totalDaily = result.reduce((sum, g) => sum + g.dailyAvg, 0);
  const avgDaily = totalDaily / result.length;
  const maxDaily = result.reduce((m, g) => (g.dailyAvg > m ? g.dailyAvg : m), 0);
  const minDaily = result.reduce((m, g) => (g.dailyAvg < m ? g.dailyAvg : m), Infinity);

  console.log('통계 (수정 후):');
  console.log(`  - 격자당 평균 일유동인구: ${Math.round(avgDaily).toLocaleString()}명`);
  console.log(`  - 최대: ${maxDaily.toLocaleString()}명`);
  console.log(`  - 최소: ${minDaily.toLocaleString()}명`);

  const top10 = result.slice().sort((a, b) => b.dailyAvg - a.dailyAvg).slice(0, 10);
  console.log('\n상위 10개 격자:');
  top10.forEach((g, i) => {
    console.log(`  ${i + 1}. ${g.dong} (${g.gid}): 일평균 ${g.dailyAvg.toLocaleString()}명`);
  });
}

main().catch((err) => {
  console.error('에러:', err);
  process.exit(1);
});
