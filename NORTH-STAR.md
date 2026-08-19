# apiflow — north star

> Bản đồ **màn hình ↔ endpoint ↔ field** cho hệ thống dùng API — dựng trực quan theo kiểu node như
> n8n, và chạy được thành test e2e.

**Bản này để chống trôi mục tiêu.** Đọc §2 và §7 trước khi thêm bất cứ tính năng nào. Repo này đã
nằm im 4 tháng một lần; bản này tồn tại để lần sau quay lại còn biết nó dùng để làm gì.

Cập nhật 2026-08-19. Anh em: `README.md` · `~/tools/repo-gates/NORTH-STAR.md` (chỉ mục 4 sản phẩm).

---

## 1. Câu hỏi nó trả lời

> **“Đổi cái này thì còn cái gì bị ảnh hưởng?”** — trả lời **trước khi sửa**.

Chất liệu của apiflow: **màn hình ↔ endpoint ↔ field.**

## 2. Ai đau, đau vì cái gì

**Ai:** người sắp đổi một endpoint hoặc một field, và không biết màn hình nào đang ăn nó. Và người
mới vào một FE lớn, không biết màn nào gọi API nào.

**Cơn đau KHÔNG phải** “thiếu công cụ test API” — chỗ đó đã chật, và Postman đang chiếm ngay trong
pipeline của chính chủ sở hữu.

**Cơn đau là:** **không ai trả lời được “đổi field này thì màn nào vỡ”.** Postman **không biết màn
hình của bạn tồn tại** — nó lưu request, không lưu quan hệ giữa request và UI. Swagger/OpenAPI mô tả
API, không mô tả ai tiêu thụ nó. Grep tên field thì ra cả nghìn dòng không phân biệt được.

## 3. Hai công dụng — và thứ tự ưu tiên

1. **Đọc (chỗ độc quyền).** Màn nào gọi API nào · API nối với nhau ra sao · field nào dùng ở đâu.
2. **Chạy (chỗ đụng Postman).** Chính bản đồ đó thành flow test e2e tự động, trực quan.

**Ưu tiên đúng thứ tự đó.** Làm vế 2 trước là đâm thẳng vào một sản phẩm đã chiếm chỗ, bằng một
repo 0 test.

| Thứ đã có | Vì sao không thay được |
|---|---|
| Postman / Bruno / Insomnia | lưu request, **không biết màn hình tồn tại** |
| OpenAPI / Swagger | mô tả API, không mô tả người tiêu thụ |
| Playwright / Cypress | chạy được luồng, không **trả lời được** câu hỏi ảnh hưởng |
| grep tên field | không phân biệt định nghĩa với tiêu thụ, không có cấu trúc |

## 4. Bằng chứng hôm nay (đo 19/08/2026) — không tô hồng

```
0 test                       — không có *.test.*, *.spec.*, không vitest/jest config
không build được từ clone    — dist/ bị gitignore, không node_modules → bin/cli.js chết ngay
commit cuối 2026-04-27       — nằm im 3,7 tháng
2.123 dòng docs/proposals/*  — README dài hơn code
src/core/executor.ts:298     — loop node là NO-OP passthrough, dù có UI + type đầy đủ
```

**Đã xử lý (19/08/2026, cùng ngày).** Bốn dòng đầu: 90 test cho `src/core/`; `bin/cli.js` tự build;
loop node đã xoá. Dòng `docs/proposals` giữ nguyên — §7 cấm viết thêm, không bắt phải dọn.
Cái mới thêm: `scan-fe` · `scan-be` · `probe` · `link` · `impact` — cả hai phía trích xuất cộng phép
nối, thứ trước đó **chưa tồn tại**.

**Phần thật sự tốt:** `src/core/` (1.435 dòng) là headless thật, dùng chung bởi cả React app lẫn MCP
server — `src/engine/*` và `src/utils/*` chỉ là shim re-export, không phải bản sao. Executor có
retry/backoff, auth theo node, chaining biến, rẽ nhánh có cắt tỉa. Cả 4 loại assertion implement đủ.
Parser cURL / OpenAPI 3.x / Postman đều thật.

**Mảnh duy nhất ĐÃ SỐNG THẬT:** `skills/api-flow-analyzer/` — một bản byte-identical đang chạy
trong một dự án nội bộ, làm Laravel routes → flow. Nó là **bản agent-only** của việc mà `scan-be`
giờ làm bằng code; giữ lại cho stack CLI chưa phủ.

Bản đồ đủ hai nửa từ 19/08/2026: `scan-fe` (màn hình → endpoint → field đọc) và `scan-be` + `probe`
(endpoint → payload → response **đã đo bằng data test**), nối bằng `link`.

**Bảo mật — đã xử lý.** `.claude/` và `.mcp.json` trong working tree chứa cấu hình nội bộ (host
và skill vận hành của một khách hàng). Chúng không tracked nhưng cũng **không ignored**, trên một
repo public — một `git add -A` là đủ để publish. Đã đưa vào `.gitignore`, commit `793f9ef` trên
`main`. Cả hai chưa từng vào git nên **không cần rewrite history**.

Không viết tên host hay tên khách vào file này: đây là file public, nên mô tả cơ chế rò rỉ thì đủ,
nêu đích danh cái cần giấu là tự làm lại đúng việc vừa chặn.

## 5. North star

> **Số lần một người trả lời được “đổi endpoint/field này thì màn hình nào vỡ” bằng apiflow — câu
> trả lời mà trước đó họ phải đi hỏi người khác.**

| Mốc | Chỉ tiêu |
|---|---|
| 30 ngày | build được từ clone sạch · loop node đã quyết · có test cho `src/core/` |
| 60 ngày | map được **1 FE thật**: màn hình → endpoint → field |
| 90 ngày | trả lời được **1 câu hỏi ảnh hưởng thật** — hoặc archive |

## 6. Kill criteria — nghiêm nhất trong bốn sản phẩm

90 ngày mà **chưa map nổi một FE thật và trả lời một câu hỏi ảnh hưởng thật** → archive repo.

Giữ lại đúng ba mảnh:
1. `skills/api-flow-analyzer/` — đã sống thật trong một dự án nội bộ.
2. `src/core/{postmanParser,openApiParser,curlParser,curlExporter}.ts` + `src/utils/postmanExporter.ts`
   → `forge/packages/core/src/integrations/postman/` (forge ghi được collection nhưng không có
   parser/generator local).
3. `src/core/{executor,assertionRunner,httpClient,variableResolver,topologicalSort}.ts`
   (~730 dòng, zero-dep) — runner headless tuỳ chọn cho stage `forge-test`.

Điều kiện sống này được viết ra vì chẩn đoán gốc là: **chưa bao giờ định nghĩa “xong”, nên không bao
giờ dừng được.**

## 7. Không làm

- **Không làm vế “chạy test” trước khi vế “bản đồ” đứng được.** Đó là đâm vào Postman bằng một repo
  0 test.
- **Không mang stub đi tiếp.** Loop node: implement, hoặc xoá cả `LoopConfigTab` và `LoopNodeConfig`.
  Một tính năng đầu bảng có UI đầy đủ mà không chạy là thứ tệ hơn không có.
- **Không viết thêm `docs/proposals/`.** Đã 2.123 dòng cho một repo 0 test. Đây là dấu vân tay của
  đúng kiểu thất bại đã giết bốn repo khác.
- **Không `git add -A` trong repo này.** `.claude/` và `.mcp.json` đã ignored, nhưng repo là public
  và thư mục làm việc có nội bộ.
- **Không xây thêm canvas trước khi có phía trích xuất.** Canvas là cách bản đồ **được đọc** —
  vô nghĩa khi chưa có bản đồ nào để đọc.

## 8. Lộ trình của repo này

Thứ tự này thay cho danh sách cũ (bản trước xếp canvas vào nhóm “bỏ” — sai dưới định vị hiện tại).

1. ✅ **Build lại được từ clone sạch.** `bin/cli.js` tự build `dist/` khi thiếu.
2. ✅ **Phía trích xuất FE.** `apiflow scan-fe` + `.apimap` + `apiflow impact` +
   `skills/fe-map-extractor`.
2b. ✅ **Phía trích xuất BE bằng CLI + probe.** `apiflow scan-be` (4 stack + generic),
   `apiflow probe` (đo response thật bằng data test), `apiflow link` (nối hai nửa),
   `skills/be-map-extractor`. `api-flow-analyzer` giờ là bản agent-only của cùng việc này.
3. ✅ **Quyết loop node.** Đã xoá.
4. ✅ **Test cho `src/core/`.** 90 test: executor, assertionRunner, ba parser, và cả lớp map mới.
5. **Map một FE thật** (mốc 60 ngày ở §5). Đây là việc mở tiếp theo — chạy `scan-fe` trên một FE
   thật, giải hết Unresolved bằng hints, và trả lời một câu hỏi ảnh hưởng thật.
6. **Canvas đọc bản đồ.** Chỉ sau khi có §8.5 — layout bằng elkjs/dagre, collapse mặc định, focus
   một node rồi bung theo bậc. Không render cả bản đồ.
7. **Chỉ sau đó** mới tính chuyện bind làm MCP vào `pipelineConfig.states.testing.mcpServers`
   (`pipeline-config-schema.ts:245` — config-only, không sửa forge core).

Trong bốn sản phẩm, apiflow public **cuối cùng** — vì **xây ít nhất**, không phải vì thiếu giá trị.

## 9. Nhật ký quyết định

- **2026-08-19** — **Không tin OpenAPI spec làm nguồn response.** Spec mốc so với code là chuyện
  thường. Response lấy từ **code** (Resource/DTO/`response_model`/struct tag), rồi **xác nhận bằng
  cách chạy thật với data test** — harness sinh ra chạy trong bộ test của chính dự án (PHPUnit
  `RefreshDatabase`, vitest+supertest, Go `httptest`, pytest `TestClient`), nên nằm trên test DB,
  không đụng DB thật. Mỗi field mang cờ `declared` và `observed` tách nhau: declared mà không
  observed = code nói dối.
- **2026-08-19** — **Phía BE cũng dùng CLI, không để agent đọc code.** Route và payload có khai báo
  tĩnh nên quét bằng code chính xác và rẻ hơn. Agent chỉ còn 4 việc máy không làm được: điền harness
  probe, phân loại field lệch (bug / có điều kiện / scanner sót), và báo cáo.
- **2026-08-19** — **Nối `.apimap` FE ↔ BE.** Khớp theo `METHOD + path chuẩn hoá`, có khớp hậu tố cho
  prefix gateway. Mở ra ba câu hỏi không nửa nào tự trả lời được: field API gửi mà không màn nào đọc ·
  field khai báo mà chưa từng gửi · endpoint không màn nào gọi.
- **2026-08-19** — **Bản đồ đọc dùng layout tính-lúc-render, không lưu toạ độ.** Tham khảo jsoncrack
  (Apache-2.0, `reaflow` → `elkjs` chạy trong web worker, có `NODE_LIMIT` vì graph DOM chết ở quy mô
  lớn): nó không bao giờ lưu `x/y`. `.apiview` giữ nguyên toạ độ cho flow người dựng tay; `.apimap`
  — bản đồ do máy sinh — chỉ lưu quan hệ. Không ai kéo tay 300 node, và toạ độ sinh ra làm mỗi lần
  re-scan thành một diff toàn file. Cùng lý do: `.apimap` **không có** `generatedAt`.
- **2026-08-19** — **Phía trích xuất FE là mảnh còn thiếu, không phải `api-flow-analyzer`.**
  `api-flow-analyzer` quét **backend** (route → endpoint) — đúng thứ Swagger đã làm. Nửa độc quyền
  ở §2 là *màn nào ăn endpoint này*, và trước hôm nay không có một dòng code nào. Đã dựng:
  `scan-fe` (CLI tất định) + `skills/fe-map-extractor` (agent chỉ xử lý phần CLI không quyết được).
- **2026-08-19** — **Xoá loop node** thay vì implement. §7 bắt quyết; loop là tính năng *chạy*, đúng
  nửa đang bị hạ ưu tiên.
- **2026-08-19** — **Rút lại kết luận “apiflow không sở hữu gì độc quyền”.** Kết luận đó đúng với
  phát biểu giá trị suy ra *từ code* (một trình chạy flow có canvas, đụng Postman). Phát biểu của
  chủ sở hữu là bản đồ phụ thuộc màn hình ↔ API ↔ field — và dưới nó apiflow sở hữu một thứ có thật.
- **2026-08-19** — `api-flow-analyzer` được nâng từ “mảnh vụn cần cứu” lên **lõi sản phẩm**.
- **2026-08-19** — Bịt lỗ rò `.claude/` + `.mcp.json`; commit `793f9ef`.
- **2026-08-19** — Remote đổi sang `git@github.com-junixlabs:junixlabs/apiflow.git` (dạng
  `git@github.com:` xác thực nhầm sang `chuonglddev` và **bị từ chối push**).
- **2026-04-27** — Commit cuối trước khi nằm im. Việc cuối là CONTRIBUTING/LICENSE/CHANGELOG, không
  phải sản phẩm.
