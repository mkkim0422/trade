const fs = require('fs');
const https = require('https');
const iconv = require('iconv-lite');

require('dotenv').config({ path: '.env.local' });
const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;

if (!KAKAO_REST_API_KEY) {
  console.error('❌ KAKAO_REST_API_KEY가 .env.local에 없습니다.');
  process.exit(1);
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const firstLine = lines[0];
  const delimiter = firstLine.includes('\t') ? '\t' : ',';

  const headers = parseCSVLine(firstLine, delimiter);

  return lines.slice(1).map((line, index) => {
    const values = parseCSVLine(line, delimiter);
    const obj = headers.reduce((acc, header, i) => {
      acc[header] = (values[i] || '').trim();
      return acc;
    }, {});
    obj._originalIndex = index + 2;
    return obj;
  }).filter(row => row['업소명']);
}

function parseCSVLine(line, delimiter) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === delimiter && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result.map(v => v.replace(/^"|"$/g, ''));
}

function getRandomCloseDate() {
  const start = new Date('2025-01-01').getTime();
  const end = new Date('2026-03-31').getTime();
  const random = start + Math.random() * (end - start);
  return new Date(random).toISOString().split('T')[0];
}

function geocodeAddress(address, retries = 3) {
  return new Promise(async (resolve) => {
    for (let i = 0; i < retries; i++) {
      try {
        const result = await geocodeSingle(address);
        resolve(result);
        return;
      } catch (err) {
        if (i === retries - 1) {
          resolve(null);
          return;
        }
        await sleep(1000);
      }
    }
  });
}

function geocodeSingle(address) {
  return new Promise((resolve, reject) => {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodedAddress}`;

    const options = {
      headers: {
        'Authorization': `KakaoAK ${KAKAO_REST_API_KEY}`
      }
    };

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.documents && json.documents.length > 0) {
            const doc = json.documents[0];
            resolve({
              lat: parseFloat(doc.y),
              lng: parseFloat(doc.x),
              address: doc.address_name
            });
          } else {
            resolve(null);
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanAddress(addr) {
  if (!addr) return '';
  return addr
    .replace(/,\s*\d+층.*$/, '')
    .replace(/\s+\d+층.*$/, '')
    .replace(/\s*\(.*?\)\s*$/, '')
    .trim();
}

async function processData() {
  console.log('📊 데이터 가공 시작...\n');

  const buffer = fs.readFileSync('public/data/localdata.csv');
  let rawCSV;
  try {
    rawCSV = iconv.decode(buffer, 'cp949');
    if (!/[가-힣]/.test(rawCSV.slice(0, 200))) {
      rawCSV = buffer.toString('utf-8');
    }
  } catch (e) {
    rawCSV = buffer.toString('utf-8');
  }

  const rows = parseCSV(rawCSV);
  console.log(`✅ CSV 파싱 완료: ${rows.length}개 매장`);
  console.log(`📋 컬럼: ${Object.keys(rows[0]).filter(k => !k.startsWith('_')).join(', ')}\n`);

  const results = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rawAddress = row['소재지(도로명)'] || row['소재지(지번)'];
    const address = cleanAddress(rawAddress);

    process.stdout.write(`\r진행: ${i + 1}/${rows.length} (성공: ${successCount}, 실패: ${failCount})   `);

    let coords = await geocodeAddress(address);

    if (!coords && row['소재지(지번)'] && rawAddress !== row['소재지(지번)']) {
      coords = await geocodeAddress(cleanAddress(row['소재지(지번)']));
    }

    if (coords) {
      results.push({
        id: `store_${i + 1}`,
        name: row['업소명'],
        category: row['업태명'] || '일반',
        address: rawAddress,
        lat: coords.lat,
        lng: coords.lng,
        status: 'closed',
        openDate: row['인허가일자'] || '',
        closeDate: getRandomCloseDate(),
        area: parseFloat(row['건물내부면적']) || 0
      });
      successCount++;
    } else {
      failCount++;
      if (failCount <= 5) {
        console.log(`\n⚠️  좌표 변환 실패 (${i + 1}/${rows.length}): ${row['업소명']} - ${rawAddress}`);
      }
    }

    await sleep(100);
  }

  console.log(`\n\n✅ 가공 완료: ${successCount}개 성공, ${failCount}개 실패 (실패율: ${((failCount/rows.length)*100).toFixed(1)}%)\n`);

  fs.writeFileSync(
    'public/data/stores.json',
    JSON.stringify(results, null, 2)
  );

  console.log('💾 저장 완료: public/data/stores.json\n');

  if (results.length > 0) {
    console.log(`📍 첫 번째 매장 샘플:`);
    console.log(JSON.stringify(results[0], null, 2));
  }

  if (failCount > rows.length * 0.3) {
    console.log('\n⚠️  경고: 실패율이 30%를 초과했습니다. 주소 형식을 확인하세요.');
  }
}

processData().catch(err => {
  console.error('\n❌ 치명적 에러:', err);
  process.exit(1);
});
