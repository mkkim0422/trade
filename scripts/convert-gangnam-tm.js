const fs = require('fs');
const iconv = require('iconv-lite');
const proj4 = require('proj4');

// LOCALDATA 공식 TM 좌표계: EPSG:5174 (Bessel TM 중부원점)
proj4.defs(
  'EPSG:5174',
  '+proj=tmerc +lat_0=38 +lon_0=127.0028902777778 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +towgs84=-115.8,474.99,674.11,1.16,-2.31,-1.63,6.43 +units=m +no_defs',
);

// 강남구 22개 행정동
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

function processData() {
  console.log('🌐 강남구 TM 좌표 → WGS84 변환 시작...\n');

  const buffer = fs.readFileSync('public/data/gangnam-localdata.csv');
  const txt = iconv.decode(buffer, 'cp949');
  const lines = txt.split('\n');

  const headers = parseCSVLine(lines[0], ',');
  console.log(`✅ CSV 파싱: ${(lines.length - 1).toLocaleString()}개 행, ${headers.length}개 컬럼\n`);

  const colIdx = (name) => headers.indexOf(name);
  const idxName = colIdx('사업장명');
  const idxRoad = colIdx('도로명주소');
  const idxJibun = colIdx('지번주소');
  const idxCategory = colIdx('업태구분명');
  const idxOpen = colIdx('인허가일자');
  const idxClose = colIdx('폐업일자');
  const idxStatus = colIdx('영업상태명');
  const idxArea = colIdx('소재지면적');
  const idxFacArea = colIdx('시설총규모');
  const idxX = colIdx('좌표정보(X)');
  const idxY = colIdx('좌표정보(Y)');

  console.log(`📋 컬럼 인덱스: 사업장명=${idxName}, 도로명주소=${idxRoad}, X=${idxX}, Y=${idxY}\n`);

  const results = [];
  let withCoord = 0;
  let noCoord = 0;
  let outOfBounds = 0;
  let parseError = 0;
  let notClosed = 0;
  let missingCloseDate = 0;
  const startTime = Date.now();

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i], ',');
    const name = cols[idxName];
    if (!name) continue;

    const status = (cols[idxStatus] || '').trim();
    if (status !== '폐업') {
      notClosed++;
      continue;
    }

    const closeDate = (cols[idxClose] || '').trim();
    if (!closeDate) {
      missingCloseDate++;
      continue;
    }

    const xRaw = cols[idxX];
    const yRaw = cols[idxY];

    if (!xRaw || !yRaw || xRaw.length === 0 || yRaw.length === 0) {
      noCoord++;
      continue;
    }

    const x = parseFloat(xRaw);
    const y = parseFloat(yRaw);

    if (isNaN(x) || isNaN(y) || x < 100000 || y < 100000) {
      parseError++;
      continue;
    }

    let lat, lng;
    try {
      const [lngVal, latVal] = proj4('EPSG:5174', 'EPSG:4326', [x, y]);
      lat = latVal;
      lng = lngVal;
    } catch (e) {
      parseError++;
      continue;
    }

    // 강남구 대략 범위 (안전 여유 포함): lat 37.45~37.56, lng 126.98~127.13
    if (lat < 37.45 || lat > 37.56 || lng < 126.98 || lng > 127.13) {
      outOfBounds++;
      continue;
    }

    const address = cols[idxRoad] || cols[idxJibun] || '';
    const areaPrimary = parseFloat(cols[idxFacArea] || cols[idxArea] || 0) || 0;

    results.push({
      id: `store_${i}`,
      name,
      category: cols[idxCategory] || '일반',
      address,
      lat,
      lng,
      status: 'closed',
      openDate: (cols[idxOpen] || '').trim(),
      closeDate,
      area: areaPrimary,
      dong: extractGangnamDong(address),
    });
    withCoord++;
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`✅ 변환 완료 (${elapsed}초)`);
  console.log(`  - 폐업 매장 (좌표 변환 성공): ${withCoord.toLocaleString()}개`);
  console.log(`  - 폐업 외 (영업/정상 등) 제외: ${notClosed.toLocaleString()}개`);
  console.log(`  - 폐업일자 없음 제외: ${missingCloseDate.toLocaleString()}개`);
  console.log(`  - 좌표 누락: ${noCoord.toLocaleString()}개 (CSV에 X/Y 없음)`);
  console.log(`  - 파싱 오류: ${parseError.toLocaleString()}개`);
  console.log(`  - 강남구 범위 밖: ${outOfBounds.toLocaleString()}개`);
  console.log(`  - 총 처리: ${(withCoord + notClosed + missingCloseDate + noCoord + parseError + outOfBounds).toLocaleString()}개\n`);

  // 기존 stores.json 백업 (양천구 → final)
  if (fs.existsSync('public/data/stores.json')) {
    const backupTarget = 'backup/yangcheon/stores-yangcheon-final.json';
    if (!fs.existsSync(backupTarget)) {
      fs.copyFileSync('public/data/stores.json', backupTarget);
      console.log(`💾 기존 stores.json 백업: ${backupTarget}\n`);
    }
  }

  fs.writeFileSync('public/data/stores.json', JSON.stringify(results, null, 2));
  console.log(`💾 저장 완료: public/data/stores.json (${results.length.toLocaleString()}개)\n`);

  if (results.length > 0) {
    console.log('📍 첫 번째 매장 샘플:');
    console.log(JSON.stringify(results[0], null, 2));

    // 동별 통계
    const dongCounts = {};
    results.forEach(s => {
      dongCounts[s.dong] = (dongCounts[s.dong] || 0) + 1;
    });
    console.log('\n📍 동별 분포:');
    Object.entries(dongCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([dong, count]) => {
        console.log(`  - ${dong}: ${count.toLocaleString()}개`);
      });

    // 업태별 통계 (TOP 10)
    const catCounts = {};
    results.forEach(s => {
      catCounts[s.category] = (catCounts[s.category] || 0) + 1;
    });
    console.log('\n🍽️  업태별 분포 (상위 10개):');
    Object.entries(catCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([cat, count]) => {
        console.log(`  - ${cat}: ${count.toLocaleString()}개`);
      });
  }
}

processData();
