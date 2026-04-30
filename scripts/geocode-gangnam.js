const fs = require('fs');
const https = require('https');
const iconv = require('iconv-lite');

require('dotenv').config({ path: '.env.local' });
const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;

if (!KAKAO_REST_API_KEY) {
  console.error('❌ KAKAO_REST_API_KEY가 .env.local에 없습니다.');
  process.exit(1);
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
  return result.map(v => v.replace(/^"|"$/g, '').trim());
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const firstLine = lines[0];
  const delimiter = firstLine.includes('\t') ? '\t' : ',';
  const headers = parseCSVLine(firstLine, delimiter);

  return lines.slice(1).map((line, index) => {
    const values = parseCSVLine(line, delimiter);
    const obj = headers.reduce((acc, header, i) => {
      acc[header] = values[i] || '';
      return acc;
    }, {});
    obj._originalIndex = index + 2;
    return obj;
  }).filter(row => (row['사업장명'] || row['업소명']));
}

function getRandomCloseDate() {
  const start = new Date('2025-01-01').getTime();
  const end = new Date('2026-03-31').getTime();
  const random = start + Math.random() * (end - start);
  return new Date(random).toISOString().split('T')[0];
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

function geocodeSingle(address) {
  return new Promise((resolve, reject) => {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodedAddress}`;
    const options = {
      headers: { 'Authorization': `KakaoAK ${KAKAO_REST_API_KEY}` },
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
              address: doc.address_name,
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

async function geocodeAddress(address, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await geocodeSingle(address);
    } catch (err) {
      if (i === retries - 1) return null;
      await sleep(1000);
    }
  }
  return null;
}

const GANGNAM_DONGS = [
  '역삼1동', '역삼2동', '논현1동', '논현2동',
  '대치1동', '대치2동', '대치4동',
  '삼성1동', '삼성2동', '청담동', '압구정동', '신사동',
  '개포1동', '개포2동', '개포4동',
  '일원본동', '일원1동', '일원2동',
  '수서동', '세곡동', '자곡동', '율현동',
];

function extractGangnamDong(address) {
  if (!address) return '알 수 없음';
  for (const dong of GANGNAM_DONGS) {
    if (address.includes(dong)) return dong;
  }
  if (address.includes('역삼동')) return '역삼1동';
  if (address.includes('논현동')) return '논현1동';
  if (address.includes('대치동')) return '대치1동';
  if (address.includes('삼성동')) return '삼성1동';
  if (address.includes('청담동')) return '청담동';
  if (address.includes('압구정동')) return '압구정동';
  if (address.includes('신사동')) return '신사동';
  if (address.includes('개포동')) return '개포1동';
  if (address.includes('일원동')) return '일원본동';
  if (address.includes('수서동')) return '수서동';
  if (address.includes('세곡동')) return '세곡동';
  if (address.includes('자곡동')) return '자곡동';
  if (address.includes('율현동')) return '율현동';
  return '알 수 없음';
}

function pickAddress(row) {
  return row['소재지(도로명)']
    || row['도로명주소']
    || row['소재지(지번)']
    || row['지번주소']
    || '';
}

function pickJibun(row) {
  return row['소재지(지번)'] || row['지번주소'] || '';
}

async function processData() {
  console.log('📊 강남구 폐업 데이터 가공 시작...\n');

  const buffer = fs.readFileSync('public/data/gangnam-localdata.csv');
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
  console.log(`✅ CSV 파싱 완료: ${rows.length.toLocaleString()}개 매장`);
  console.log(`📋 컬럼: ${Object.keys(rows[0]).filter(k => !k.startsWith('_')).slice(0, 10).join(', ')}...\n`);

  const results = [];
  let successCount = 0;
  let failCount = 0;
  const startTime = Date.now();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rawAddress = pickAddress(row);
    const address = cleanAddress(rawAddress);

    if (!address || address.length < 5) {
      failCount++;
      continue;
    }

    if ((i + 1) % 50 === 0 || i === 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = (i + 1) / elapsed;
      const eta = Math.round((rows.length - i - 1) / rate);
      const etaMin = Math.floor(eta / 60);
      const etaSec = eta % 60;
      process.stdout.write(`\r진행: ${i + 1}/${rows.length} (성공: ${successCount}, 실패: ${failCount}) | ETA: ${etaMin}m ${etaSec}s   `);
    }

    let coords = await geocodeAddress(address);
    if (!coords) {
      const jibun = cleanAddress(pickJibun(row));
      if (jibun && jibun !== address) {
        coords = await geocodeAddress(jibun);
      }
    }

    if (coords) {
      results.push({
        id: `store_${i + 1}`,
        name: row['사업장명'] || row['업소명'],
        category: row['업태구분명'] || row['업태명'] || row['업종'] || '일반',
        address: rawAddress,
        lat: coords.lat,
        lng: coords.lng,
        status: 'closed',
        openDate: (row['인허가일자'] || row['개업일자'] || '').trim(),
        closeDate: getRandomCloseDate(),
        area: parseFloat(row['시설총규모'] || row['건물내부면적'] || row['면적'] || row['소재지면적'] || 0) || 0,
        dong: extractGangnamDong(rawAddress),
      });
      successCount++;
    } else {
      failCount++;
      if (failCount <= 5) {
        console.log(`\n⚠️  좌표 변환 실패 (${i + 1}/${rows.length}): ${row['사업장명'] || row['업소명']} - ${rawAddress}`);
      }
    }

    await sleep(100);
  }

  const totalElapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n\n✅ 가공 완료: ${successCount}개 성공, ${failCount}개 실패 (실패율: ${((failCount / rows.length) * 100).toFixed(1)}%)`);
  console.log(`⏱️  소요 시간: ${Math.floor(totalElapsed / 60)}분 ${totalElapsed % 60}초\n`);

  if (fs.existsSync('public/data/stores.json')) {
    fs.copyFileSync('public/data/stores.json', 'backup/yangcheon/stores-yangcheon-final.json');
    console.log('💾 기존 stores.json 백업: backup/yangcheon/stores-yangcheon-final.json\n');
  }

  fs.writeFileSync('public/data/stores.json', JSON.stringify(results, null, 2));
  console.log('💾 저장 완료: public/data/stores.json\n');

  if (results.length > 0) {
    console.log('📍 첫 번째 매장 샘플:');
    console.log(JSON.stringify(results[0], null, 2));
    console.log(`\n📊 통계:`);
    console.log(`  - 총 매장: ${results.length.toLocaleString()}개`);
    console.log(`  - 성공률: ${((successCount / rows.length) * 100).toFixed(1)}%`);

    const dongCounts = {};
    results.forEach(s => {
      dongCounts[s.dong] = (dongCounts[s.dong] || 0) + 1;
    });
    console.log(`\n📍 동별 분포 (상위 10개):`);
    Object.entries(dongCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([dong, count]) => {
        console.log(`  - ${dong}: ${count}개`);
      });
  }

  if (failCount > rows.length * 0.3) {
    console.log('\n⚠️  경고: 실패율이 30%를 초과했습니다. CSV 컬럼명을 확인하세요.');
  }
}

processData().catch(err => {
  console.error('\n❌ 치명적 에러:', err);
  process.exit(1);
});
