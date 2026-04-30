const fs = require('fs');

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
