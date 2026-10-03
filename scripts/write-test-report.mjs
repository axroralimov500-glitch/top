import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// TAP reporter — barqaror matn, hisobotga osongina joylanadi.
const res = spawnSync(
  process.execPath,
  ['--test', '--test-reporter=tap', 'test/*.test.mjs'],
  { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
);

const output = (res.stdout ?? '') + (res.stderr ?? '');
const grab = (re) => {
  const m = output.match(re);
  return m ? Number(m[1]) : null;
};

const total = grab(/^# tests (\d+)$/m);
const pass = grab(/^# pass (\d+)$/m);
const fail = grab(/^# fail (\d+)$/m);
const skipped = grab(/^# skipped (\d+)$/m);

const status = fail === 0 ? 'MUVAFFAQIYATLI' : 'MUVAFFAQIYATSIZ';
const report = `# Test hisoboti

- Sana: ${new Date().toISOString()}
- Node.js: ${process.version} (${process.platform}-${process.arch})
- Buyruq: \`npm run test:report\` (node --test --test-reporter=tap test/*.test.mjs)
- Yakuniy holat: **${status}**

## Xulosa

| Ko'rsatkich | Qiymat |
|---|---|
| Jami testlar | ${total ?? '?'} |
| Muvaffaqiyatli | ${pass ?? '?'} |
| Muvaffaqiyatsiz | ${fail ?? '?'} |
| O'tkazib yuborilgan | ${skipped ?? '?'} |

Qamrov asosiy biznes qoidalarini berkitadi:

1. **Parallel rezerv** — qoldiq 1 bo'lganda ikki parallel HTTP xarid va 6 ta
   alohida DB ulanish (worker_threads) raqobatida aynan bittasi rezerv oladi
   (test/concurrency.test.mjs).
2. **Callback idempotentligi** — takroriy callback to'lov yozuvini ham,
   qoldiq yechishni ham takrorlamaydi (test/payments.test.mjs).
3. **Faqat bir marta bekor qilish** — ikkinchi bekor 409, PATCH orqali
   qayta ochish 409 ORDER_STATUS_IMMUTABLE (test/cancel.test.mjs).
4. Rezerv TTL tugashi va kechikkan to'lov rad etilishi (test/expiry.test.mjs).
5. Narx nusxasi buyurtmada muzlatiladi (test/orders.test.mjs).
6. max_purchase_qty savat va buyurtmada (test/maxqty.test.mjs).
7. Rollar: mijoz admin marshrutlariga kira olmaydi (test/auth.test.mjs).
8. Kirim + qayta-narxlash: yangi partiya eski qoldiq narxini ham yangilaydi,
   tarix yoziladi, lekin eski buyurtma narx nusxasi o'zgarmaydi
   (test/receipts.test.mjs).
9. **Ikki bosqichli admin kirishi** — admin /auth/login da rad etiladi,
   1-bosqich challenge token bermaydi, ikkinchi parol xato bo'lsa 403,
   twofa belgisisiz token /admin/* ga kira olmaydi, eskigan challenge 401
   (test/admin2fa.test.mjs).
10. Katalog qidiruvi — GET /products?q= nom bo'yicha qismiy moslikni
    qaytaradi, mos bo'lmasa 0 natija (test/catalog.test.mjs).
11. **Faqat narxni o'zgartirish** (POST /admin/reprice) — partiya kelmaydi,
    qoldiq o'zgarmaydi, lekin butun mavjud qoldiq (eski partiya ham) yangi
    narxda sotiladi; tarixda "faqat narx" (kind='reprice', omborsiz) qator
    bo'ladi; eski buyurtma narx nusxasi o'zgarmaydi; bir xil narx / noto'g'ri
    qiymat 400, variant yo'q bo'lsa 404, mijoz 403, token siz 401
    (test/receipts.test.mjs).

## To'liq TAP natijasi

\`\`\`tap
${output.trimEnd()}
\`\`\`
`;

mkdirSync(path.join(root, 'docs'), { recursive: true });
writeFileSync(path.join(root, 'docs', 'test-report.md'), report);
console.log(`[hisobot] docs/test-report.md yozildi — ${pass}/${total} muvaffaqiyatli, ${fail} xato`);

process.exitCode = res.status ?? 1;
