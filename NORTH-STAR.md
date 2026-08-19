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

**Phần thật sự tốt:** `src/core/` (1.435 dòng) là headless thật, dùng chung bởi cả React app lẫn MCP
server — `src/engine/*` và `src/utils/*` chỉ là shim re-export, không phải bản sao. Executor có
retry/backoff, auth theo node, chaining biến, rẽ nhánh có cắt tỉa. Cả 4 loại assertion implement đủ.
Parser cURL / OpenAPI 3.x / Postman đều thật.

**Mảnh duy nhất ĐÃ SỐNG THẬT:** `skills/api-flow-analyzer/` — một bản byte-identical đang chạy
trong một dự án nội bộ, làm Laravel routes → flow.
**Dưới định vị bản đồ phụ thuộc, đây là LÕI, không phải mảnh vụn cần cứu** — nó chính là phía trích
xuất.

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

1. **Build lại được từ clone sạch.** Bỏ `dist/` khỏi gitignore, hoặc thêm bước build vào
   `bin/cli.js`. Người lạ hiện chạy lệnh đầu tiên là gãy.
2. **`api-flow-analyzer` thành mảnh hạng nhất.** Trích màn hình → endpoint → field từ một FE thật.
   Đây là lõi, không phải skill phụ.
3. **Quyết loop node.** Implement hoặc xoá.
4. **Test cho `src/core/`.** Executor, assertionRunner, ba parser là phần đáng test nhất.
5. **Chỉ sau đó** mới tính chuyện bind làm MCP vào `pipelineConfig.states.testing.mcpServers`
   (`pipeline-config-schema.ts:245` — config-only, không sửa forge core).

Trong bốn sản phẩm, apiflow public **cuối cùng** — vì **xây ít nhất**, không phải vì thiếu giá trị.

## 9. Nhật ký quyết định

- **2026-08-19** — **Rút lại kết luận “apiflow không sở hữu gì độc quyền”.** Kết luận đó đúng với
  phát biểu giá trị suy ra *từ code* (một trình chạy flow có canvas, đụng Postman). Phát biểu của
  chủ sở hữu là bản đồ phụ thuộc màn hình ↔ API ↔ field — và dưới nó apiflow sở hữu một thứ có thật.
- **2026-08-19** — `api-flow-analyzer` được nâng từ “mảnh vụn cần cứu” lên **lõi sản phẩm**.
- **2026-08-19** — Bịt lỗ rò `.claude/` + `.mcp.json`; commit `793f9ef`.
- **2026-08-19** — Remote đổi sang `git@github.com-junixlabs:junixlabs/apiflow.git` (dạng
  `git@github.com:` xác thực nhầm sang `chuonglddev` và **bị từ chối push**).
- **2026-04-27** — Commit cuối trước khi nằm im. Việc cuối là CONTRIBUTING/LICENSE/CHANGELOG, không
  phải sản phẩm.
