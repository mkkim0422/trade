const fs = require('fs');
const path = require('path');

console.log('GID -> 좌표 매핑 추가\n');

// 강남구 동별 중심 좌표 (정확한 GID 격자 좌표 매핑이 없으므로 임시)
const DONG_CENTERS = {
  '역삼동': { lat: 37.5007, lng: 127.0368 },
  '논현동': { lat: 37.5091, lng: 127.0228 },
  '대치동': { lat: 37.4950, lng: 127.0635 },
  '삼성동': { lat: 37.5147, lng: 127.0530 },
  '청담동': { lat: 37.5203, lng: 127.0495 },
  '압구정동': { lat: 37.5259, lng: 127.0298 },
  '신사동': { lat: 37.5203, lng: 127.0228 },
  '도곡동': { lat: 37.4849, lng: 127.0426 },
  '개포동': { lat: 37.4838, lng: 127.0495 },
  '일원동': { lat: 37.4838, lng: 127.0775 },
  '수서동': { lat: 37.4838, lng: 127.1055 },
  '세곡동': { lat: 37.4670, lng: 127.1055 },
  '자곡동': { lat: 37.4726, lng: 127.0915 },
  '율현동': { lat: 37.4670, lng: 127.0775 },
};

const GANGNAM_GU_CENTER = { lat: 37.5172, lng: 127.0473 };

const inputPath = 'C:/Users/User/OneDrive/바탕 화면/회사/00.연습/trade2/public/data/foottraffic.json';
const foottraffic = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));

console.log(`원본 격자 수: ${foottraffic.length}개\n`);

// GID 해시 기반 결정적 오프셋 (같은 동 내 분산)
function hashGid(gid) {
  let hash = 0;
  for (let i = 0; i < gid.length; i++) {
    hash = ((hash << 5) - hash) + gid.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const withCoords = foottraffic.map((grid) => {
  const dongName = grid.dong.replace(/[0-9]/g, '');
  const coords = DONG_CENTERS[dongName] || GANGNAM_GU_CENTER;

  const hash = hashGid(grid.gid);
  // ±0.005도 (약 ±500m)
  const offsetLat = (((hash % 1000) - 500) / 100000);
  const offsetLng = ((((hash >> 8) % 1000) - 500) / 100000);

  return {
    ...grid,
    lat: Math.round((coords.lat + offsetLat) * 1000000) / 1000000,
    lng: Math.round((coords.lng + offsetLng) * 1000000) / 1000000,
  };
});

fs.writeFileSync(inputPath, JSON.stringify(withCoords, null, 2));

const dongCounts = {};
withCoords.forEach((g) => {
  const d = g.dong.replace(/[0-9]/g, '');
  dongCounts[d] = (dongCounts[d] || 0) + 1;
});

console.log('동별 격자 수:');
Object.entries(dongCounts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([d, c]) => console.log(`  ${d}: ${c}개`));

console.log('\n상위 5개 격자 (좌표 포함):');
withCoords
  .slice()
  .sort((a, b) => b.dailyAvg - a.dailyAvg)
  .slice(0, 5)
  .forEach((g) => {
    console.log(`  ${g.dong} (${g.gid}): (${g.lat}, ${g.lng}) - ${g.dailyAvg.toLocaleString()}명/일`);
  });

console.log('\n좌표 매핑 완료');
