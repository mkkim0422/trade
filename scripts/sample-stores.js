const fs = require('fs');

// ⚠️ DEPRECATED — 발표용 데이터에서는 *절대* 재실행 금지.
// 1차 작업 시 동별 500개로 다운샘플링하던 스크립트. 현재 stores.json은 전체 34,797개 (실데이터).
// 통계 정확도를 위해 재실행 시 백업 stores-full.json을 먼저 확인.
if (!process.env.ALLOW_SAMPLE) {
  console.error('❌ 이 스크립트는 동별 500개 cap을 강제 적용함. 통계 왜곡.');
  console.error('   재실행 의도가 있으면 ALLOW_SAMPLE=1 환경변수와 함께 실행.');
  process.exit(1);
}

console.log('📊 매장 데이터 샘플링 시작...\n');

const stores = JSON.parse(fs.readFileSync('public/data/stores.json', 'utf-8'));
console.log(`원본: ${stores.length.toLocaleString()}개 매장\n`);

const byDong = {};
stores.forEach(store => {
  const dong = store.dong || '알 수 없음';
  if (!byDong[dong]) byDong[dong] = [];
  byDong[dong].push(store);
});

console.log('동별 분포:');
Object.entries(byDong)
  .sort((a, b) => b[1].length - a[1].length)
  .forEach(([dong, list]) => {
    console.log(`  ${dong}: ${list.length.toLocaleString()}개`);
  });

const MAX_PER_DONG = 500;
const sampled = [];

Object.entries(byDong).forEach(([dong, list]) => {
  const sorted = list.sort((a, b) => {
    if (!a.closeDate) return 1;
    if (!b.closeDate) return -1;
    return b.closeDate.localeCompare(a.closeDate);
  });
  const selected = sorted.slice(0, Math.min(MAX_PER_DONG, sorted.length));
  sampled.push(...selected);
});

console.log(`\n✅ 샘플링 완료: ${sampled.length.toLocaleString()}개 매장`);
console.log(`축소율: ${((sampled.length / stores.length) * 100).toFixed(1)}%\n`);

fs.copyFileSync('public/data/stores.json', 'public/data/stores-full.json');
console.log('💾 원본 백업: public/data/stores-full.json\n');

fs.writeFileSync('public/data/stores.json', JSON.stringify(sampled, null, 2));
console.log('💾 샘플 저장: public/data/stores.json\n');

console.log('동별 샘플 분포:');
const sampledByDong = {};
sampled.forEach(store => {
  const dong = store.dong || '알 수 없음';
  sampledByDong[dong] = (sampledByDong[dong] || 0) + 1;
});

Object.entries(sampledByDong)
  .sort((a, b) => b[1] - a[1])
  .forEach(([dong, count]) => {
    console.log(`  ${dong}: ${count.toLocaleString()}개`);
  });

console.log('\n💡 전체 데이터 복원: stores-full.json을 stores.json으로 덮어쓰기');
