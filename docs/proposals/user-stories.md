# API View — User Stories

## Epic 1: Flow Canvas Management

### US-1.1: Tạo flow mới

**As a** backend developer
**I want to** tạo một flow trống trên canvas
**So that** tôi có thể bắt đầu thiết kế API chain cho tính năng đang phát triển

**Acceptance Criteria:**
- Mở app → thấy canvas trống sẵn sàng sử dụng
- Có thể đặt tên cho flow
- Canvas hỗ trợ zoom in/out và pan (kéo di chuyển)

---

### US-1.2: Thêm API node vào canvas

**As a** backend developer
**I want to** kéo thả hoặc click để thêm một API node vào canvas
**So that** tôi có thể đại diện cho 1 API endpoint trong flow

**Acceptance Criteria:**
- Thêm node mới bằng cách double-click trên canvas hoặc nút "Add Node"
- Mỗi node hiển thị: HTTP method (GET/POST/PUT/DELETE/PATCH), URL, và tên tùy chỉnh
- Node có màu sắc phân biệt theo HTTP method
- Có thể di chuyển node tự do trên canvas

---

### US-1.3: Cấu hình API node

**As a** backend developer
**I want to** cấu hình chi tiết cho mỗi API node (URL, method, headers, body, query params)
**So that** node có thể thực hiện đúng API call khi chạy

**Acceptance Criteria:**
- Click vào node → mở panel cấu hình bên phải
- Cấu hình bao gồm:
  - HTTP Method (dropdown)
  - URL (text input, hỗ trợ variable placeholder như `{{base_url}}`)
  - Headers (key-value editor)
  - Query Parameters (key-value editor)
  - Request Body (JSON editor với syntax highlighting)
  - Authentication (Bearer token, Basic auth, hoặc custom header)
- Thay đổi được lưu tự động khi rời khỏi panel

---

### US-1.4: Kết nối các node

**As a** backend developer
**I want to** kéo đường nối từ node A sang node B
**So that** tôi định nghĩa được thứ tự thực thi: A chạy trước, B chạy sau

**Acceptance Criteria:**
- Kéo từ output port (bên phải node) đến input port (bên trái node) để tạo connection
- Đường nối có mũi tên chỉ hướng thực thi
- 1 node có thể nối đến nhiều node tiếp theo (parallel execution)
- 1 node có thể nhận input từ nhiều node trước đó (wait all hoặc wait any)
- Có thể xóa connection bằng click vào đường nối + Delete

---

### US-1.5: Xóa node và connection

**As a** backend developer
**I want to** xóa node hoặc connection khỏi canvas
**So that** tôi có thể điều chỉnh flow khi thiết kế sai

**Acceptance Criteria:**
- Select node → nhấn Delete hoặc Backspace để xóa
- Xóa node sẽ xóa luôn tất cả connection liên quan
- Có thể Undo (Ctrl+Z) sau khi xóa

---

## Epic 2: Flow Execution & Inspection

### US-2.1: Chạy toàn bộ flow

**As a** backend developer
**I want to** nhấn nút "Run" để chạy toàn bộ flow theo thứ tự đã nối
**So that** tôi thấy được kết quả của từng API trong cả chain

**Acceptance Criteria:**
- Nhấn "Run" → flow thực thi theo topological order (node không có dependency chạy trước)
- Trong khi chạy, node đang thực thi có visual indicator (loading spinner, border highlight)
- Node thành công → viền xanh, node lỗi → viền đỏ
- Sau khi chạy xong, mỗi node hiển thị status code và thời gian response
- Flow dừng lại nếu 1 node lỗi (có option để tiếp tục dù lỗi)

---

### US-2.2: Chạy từng node riêng lẻ

**As a** backend developer
**I want to** right-click một node và chọn "Run this node"
**So that** tôi có thể test 1 API cụ thể mà không cần chạy cả flow

**Acceptance Criteria:**
- Right-click node → context menu → "Run This Node"
- Node chạy độc lập, sử dụng config hiện tại
- Kết quả hiển thị ngay trong inspection panel

---

### US-2.3: Inspect response chi tiết

**As a** backend developer
**I want to** click vào node đã chạy xong để xem chi tiết request/response
**So that** tôi biết chính xác data shape, field names, và giá trị trả về

**Acceptance Criteria:**
- Click node đã chạy → panel hiển thị:
  - **Request tab:** Method, URL (đã resolved), Headers, Body đã gửi
  - **Response tab:** Status code, Headers, Body (JSON formatted + syntax highlighted)
  - **Timing tab:** Duration, size
- JSON response có thể collapse/expand từng level
- Có thể copy response hoặc từng field
- Có search/filter trong JSON response

---

### US-2.4: Xem data flow giữa các node

**As a** backend developer
**I want to** thấy rõ data nào từ node trước được dùng ở node sau
**So that** tôi hiểu được cách data collect và liên kết giữa các API

**Acceptance Criteria:**
- Khi hover lên connection line → tooltip hiển thị data được truyền
- Trong config của node B, có thể reference output từ node A bằng syntax: `{{nodes["Get Product"].response.body.id}}`
- Khi inspect, hiển thị cả raw value (trước resolve) và resolved value (sau resolve)
- Highlight visual trên canvas khi 1 field đang được reference bởi node khác

---

## Epic 3: Environment & Variables

### US-3.1: Quản lý environment variables

**As a** backend developer
**I want to** định nghĩa biến môi trường (base_url, api_key, token)
**So that** tôi có thể switch giữa local/staging/production mà không sửa từng node

**Acceptance Criteria:**
- Có environment panel quản lý key-value pairs
- Hỗ trợ nhiều environment (Local, Staging, Production)
- Switch environment bằng dropdown
- Trong node config, dùng `{{base_url}}` để reference
- Sensitive values (token, api_key) hiển thị masked (***), chỉ show khi click

---

### US-3.2: Dynamic variables từ response

**As a** backend developer
**I want to** sử dụng giá trị từ response của node trước làm input cho node sau
**So that** tôi có thể chain API calls với data thực tế (ví dụ: lấy product_id từ API 1 để gọi API 2)

**Acceptance Criteria:**
- Syntax: `{{nodes["Node Name"].response.body.path.to.field}}`
- Autocomplete khi gõ `{{` → hiển thị danh sách node và field available
- Nếu node trước chưa chạy, hiển thị warning
- Hỗ trợ access vào nested object và array: `{{nodes["Get Products"].response.body.data[0].id}}`

---

## Epic 4: Flow Persistence

### US-4.1: Lưu flow thành file

**As a** backend developer
**I want to** lưu flow hiện tại thành file JSON
**So that** tôi có thể mở lại sau, hoặc commit vào repo cùng source code

**Acceptance Criteria:**
- Ctrl+S hoặc nút Save → lưu thành `.apiview` file (JSON format)
- File bao gồm: nodes, connections, positions, configurations, environments
- Tên file mặc định theo tên flow
- Chọn được thư mục lưu

---

### US-4.2: Mở flow đã lưu

**As a** backend developer
**I want to** mở file flow đã lưu trước đó
**So that** tôi quay lại xem flow khi cần debug hoặc review

**Acceptance Criteria:**
- Ctrl+O hoặc nút Open → file picker chọn `.apiview` file
- Flow được restore đúng vị trí node, connection, và config
- Nếu file bị corrupt, hiển thị error message rõ ràng

---

### US-4.3: Flow library

**As a** backend developer
**I want to** thấy danh sách tất cả flow đã lưu khi mở app
**So that** tôi nhanh chóng chọn flow cần xem mà không cần tìm file

**Acceptance Criteria:**
- Sidebar hoặc home screen hiển thị danh sách flow đã lưu
- Mỗi flow hiển thị: tên, mô tả ngắn, số lượng node, ngày sửa cuối
- Có thể search flow theo tên
- Có thể xóa flow khỏi library

---

## Epic 5: Documentation & Export

### US-5.1: Export flow thành hình ảnh

**As a** backend developer
**I want to** export canvas thành PNG/SVG
**So that** tôi có thể đưa vào tài liệu, wiki, hoặc gửi cho team

**Acceptance Criteria:**
- Nút Export → chọn PNG hoặc SVG
- Hình ảnh bao gồm tất cả node và connection trên canvas
- Background trắng (cho tài liệu) hoặc transparent (cho wiki)

---

### US-5.2: Ghi chú trên node

**As a** backend developer
**I want to** thêm note/description cho mỗi node
**So that** tôi ghi lại lý do tại sao API này nằm ở vị trí này trong flow, hoặc lưu ý đặc biệt

**Acceptance Criteria:**
- Mỗi node có trường "Description" trong config panel
- Description hiển thị dạng tooltip khi hover lên node
- Hỗ trợ markdown cơ bản (bold, italic, list)

---

### US-5.3: Annotation trên canvas

**As a** backend developer
**I want to** thêm text annotation tự do trên canvas
**So that** tôi có thể nhóm các node lại và ghi chú mục đích của từng nhóm

**Acceptance Criteria:**
- Thêm text box tự do trên canvas
- Có thể thay đổi font size, màu sắc
- Text box không ảnh hưởng đến flow execution
- Có thể group nodes vào 1 frame/box với label

---

## Epic 6: Developer Experience

### US-6.1: Keyboard shortcuts

**As a** backend developer
**I want to** sử dụng keyboard shortcuts cho các thao tác thường xuyên
**So that** tôi thao tác nhanh hơn mà không cần dùng chuột

**Acceptance Criteria:**
- `Ctrl+S` — Save flow
- `Ctrl+O` — Open flow
- `Ctrl+Enter` — Run flow
- `Delete/Backspace` — Xóa node/connection đang chọn
- `Ctrl+Z` — Undo
- `Ctrl+Shift+Z` — Redo
- `Ctrl+D` — Duplicate node
- `Space + Drag` — Pan canvas
- `Ctrl + Scroll` — Zoom

---

### US-6.2: Import từ cURL

**As a** backend developer
**I want to** paste cURL command để tạo node tự động
**So that** tôi không phải nhập lại thông tin API đã có sẵn từ browser DevTools hoặc documentation

**Acceptance Criteria:**
- Nút "Import cURL" hoặc paste cURL vào canvas
- Parse tự động: method, URL, headers, body, query params
- Tạo node mới với config đã filled
- Hỗ trợ cURL format phổ biến (với -H, -d, -X flags)

---

### US-6.3: Import từ OpenAPI/Swagger

**As a** backend developer
**I want to** import file OpenAPI spec để tạo danh sách available endpoints
**So that** tôi kéo thả endpoint vào canvas thay vì nhập thủ công

**Acceptance Criteria:**
- Import file `.yaml` hoặc `.json` OpenAPI spec
- Hiển thị sidebar danh sách endpoints grouped theo tag
- Kéo endpoint từ sidebar vào canvas → tạo node với method, URL, và example body
- Có thể refresh khi spec thay đổi
