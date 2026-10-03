# ALOHA PRODUCTS & CATEGORIES API SPECIFICATION & INTEGRATION GUIDE
> **Tài liệu chuẩn hóa API Sản Phẩm (`aloha_products`) & Danh Mục (`categories`)** dành cho các hệ thống Client, Web E-Commerce (như `shop.alohathegioichaucay`) và các Agent AI tích hợp.

---

## 1. TỔNG QUAN HỆ THỐNG & KẾT NỐI

### 1.1. Base URL
- **Môi trường Local Development:** `http://localhost:5000/api`
- **Môi trường Production / Staging:** `https://api.your-domain.com/api` (hoặc cấu hình qua biến môi trường `NEXT_PUBLIC_API_URL` / `VITE_API_URL`)

### 1.2. Cơ chế Xác thực (Authentication)
Tất cả các API Sản Phẩm và Danh Mục đều được bảo vệ bằng cơ chế **JWT Bearer Token**:
- **Header bắt buộc:**
  ```http
  Authorization: Bearer <JWT_TOKEN>
  Content-Type: application/json
  ```
- **Cách lấy Token (API Đăng nhập):**
  - **Endpoint:** `POST /api/auth/login`
  - **Payload:**
    ```json
    {
      "username": "admin",
      "password": "your_password"
    }
    ```
  - **Response (200 OK):**
    ```json
    {
      "success": true,
      "message": "Đăng nhập thành công",
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "user": {
        "id": "673c...",
        "username": "admin",
        "role": "admin",
        "ten": "Quản Trị Viên"
      }
    }
    ```

---

## 2. CẤU TRÚC DỮ LIỆU SẢN PHẨM (PRODUCT DATA MODEL)

Dữ liệu sản phẩm được lưu trữ trong collection `aloha_products` với cấu trúc chuẩn:

| Thuộc tính | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `ma` | `string` | **Có** | Mã SKU sản phẩm (Unique, ví dụ: `HG15X10X10`, `CC001`). Đây là khóa chính dùng để truy vấn |
| `ten` | `string` | **Có** | Tên sản phẩm hiển thị ngắn gọn |
| `fullName` | `string` | Không | Tên đầy đủ của sản phẩm |
| `barcode` | `string` | Không | Mã vạch sản phẩm (đã đánh index để quét mã) |
| `dvt` | `string` | Không | Đơn vị tính (cái, bộ, chậu, bao, kg,...) |
| `productType` | `number` | Không | Loại sản phẩm: <br>• `1`: Hàng hóa chuẩn (Standard/Lẻ)<br>• `2`: Combo (Đóng gói từ linh kiện)<br>• `3`: Dịch vụ (Service) |
| `ton` | `number` | Không | Số lượng tồn kho thực tế hiện tại |
| `tonMin` | `number` | Không | Định mức tồn kho tối thiểu (an toàn) |
| `tonMax` | `number` | Không | Định mức tồn kho tối đa |
| `giaBan` | `number` | Không | Giá bán lẻ mặc định |
| `giaChung` | `number` | Không | Giá bán chung niêm yết tại cửa hàng |
| `giaSi` | `number` | Không | Giá bán sỉ/buôn cho đại lý |
| `giaWeb` | `number` | Không | **Giá bán niêm yết trên Website / E-Commerce Shop** |
| `giaTruocGiam` | `number` | Không | Giá gốc trước khi giảm (dùng để hiển thị giá gạch ngang) |
| `giaVon` | `number` | Không | Giá vốn nhập kho (nội bộ, backend bảo mật) |
| `categoryId` | `number` | Không | ID danh mục sản phẩm (liên kết với `categories.categoryId`) |
| `categoryName` | `string` | Không | Tên danh mục sản phẩm |
| `ancestor` | `array` | Không | Cây phân cấp danh mục cha từ gốc đến lá: `[ { "id": 1, "name": "Chậu cây" }, ... ]` |
| `thuongHieu` | `string` | Không | Thương hiệu sản phẩm |
| `viTri` | `string` | Không | Vị trí lưu kho (kệ, tầng, gian) |
| `trongLuong` | `number` | Không | Trọng lượng sản phẩm (gram) phục vụ tính phí ship |
| `allowsSale` | `boolean` | Không | Cờ cho phép bán (`true`/`false`) |
| `description` | `string` | Không | Mô tả chi tiết (hỗ trợ text hoặc HTML) |
| `images` | `string[]` | Không | Mảng chứa danh sách URL hình ảnh sản phẩm |
| `videos` | `string[]` | Không | Mảng chứa danh sách URL video sản phẩm |
| `attributes` | `object[]` | Không | Mảng thuộc tính (kích thước, màu sắc, chất liệu,...): `[{ "attributeName": "Màu", "attributeValue": "Đỏ" }]` |
| `hangThanhPhan`| `object[]` | Không | **Dành riêng cho Combo (`productType = 2`)**: Danh sách linh kiện con cấu thành combo |
| `createdAt` | `string` | Không | Ngày tạo ISO timestamp (đồng bộ chuẩn từ createdDate KiotViet) |
| `updatedAt` | `string` | Không | Ngày cập nhật ISO timestamp |

---

## 3. CẤU TRÚC DỮ LIỆU DANH MỤC (CATEGORY DATA MODEL)

Dữ liệu danh mục được lưu trữ trong collection `categories` (đồng bộ phân cấp từ KiotViet):

| Thuộc tính | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `categoryId` | `number` | **Có** | ID danh mục số nguyên (Unique, ví dụ: `10001`, `10002`) |
| `categoryName` | `string` | **Có** | Tên danh mục (ví dụ: `Chậu Cây`, `Chậu Đất Nung`, `Bình Cắm Hoa`) |
| `parentId` | `number / null` | Không | ID danh mục cha. Nếu là danh mục gốc (Level 1) thì `parentId = null` |
| `quantity` | `number` | Không | Số lượng sản phẩm trực tiếp thuộc danh mục này |
| `sl` | `number` | Không | Số lượng sản phẩm tích lũy (bao gồm sản phẩm thuộc danh mục con cháu) |
| `createdAt` | `string` | Không | Thời điểm tạo danh mục |
| `updatedAt` | `string` | Không | Thời điểm cập nhật danh mục |

---

## 4. CHI TIẾT CÁC API DANH MỤC (CATEGORY APIS)

### 4.1. Lấy toàn bộ danh mục hoặc Tìm kiếm danh mục
Dùng để dựng cây danh mục (Category Tree Menu), thanh điều hướng (Navbar), hoặc bộ lọc sản phẩm.

- **Phương thức:** `GET`
- **Đường dẫn:** `/categories`
- **Xác thực:** Yêu cầu Bearer Token

#### Tham số Query Parameters:
| Tham số | Kiểu | Mặc định | Ý nghĩa |
| :--- | :--- | :---: | :--- |
| `q` hoặc `name` | `string` | `undefined` | Tìm kiếm danh mục theo từ khóa tên hoặc mã `categoryId` (không phân biệt hoa/thường) |
| `limit` | `integer` | `undefined` | Giới hạn số lượng danh mục trả về |

#### Ví dụ Request:
```http
GET /api/categories HTTP/1.1
Host: localhost:5000
Authorization: Bearer <TOKEN>
```

#### Ví dụ Response (200 OK):
```json
{
  "success": true,
  "count": 6,
  "data": [
    {
      "_id": "673c00000000000000000001",
      "categoryId": 1001,
      "categoryName": "Chậu Cây Cảnh",
      "parentId": null,
      "quantity": 120,
      "sl": 450,
      "createdAt": "2026-01-10T00:00:00.000Z",
      "updatedAt": "2026-09-18T00:00:00.000Z"
    },
    {
      "_id": "673c00000000000000000002",
      "categoryId": 1002,
      "categoryName": "Chậu Đất Nung",
      "parentId": 1001,
      "quantity": 85,
      "sl": 85,
      "createdAt": "2026-01-10T00:00:00.000Z",
      "updatedAt": "2026-09-18T00:00:00.000Z"
    },
    {
      "_id": "673c00000000000000000003",
      "categoryId": 1003,
      "categoryName": "Chậu Xi Măng Đá Mài",
      "parentId": 1001,
      "quantity": 110,
      "sl": 110,
      "createdAt": "2026-01-10T00:00:00.000Z",
      "updatedAt": "2026-09-18T00:00:00.000Z"
    },
    {
      "_id": "673c00000000000000000004",
      "categoryId": 2001,
      "categoryName": "Cây Cảnh Trong Nhà",
      "parentId": null,
      "quantity": 60,
      "sl": 230,
      "createdAt": "2026-01-10T00:00:00.000Z",
      "updatedAt": "2026-09-18T00:00:00.000Z"
    },
    {
      "_id": "673c00000000000000000005",
      "categoryId": 2002,
      "categoryName": "Cây Lọc Không Khí",
      "parentId": 2001,
      "quantity": 90,
      "sl": 90,
      "createdAt": "2026-01-10T00:00:00.000Z",
      "updatedAt": "2026-09-18T00:00:00.000Z"
    },
    {
      "_id": "673c00000000000000000006",
      "categoryId": 3001,
      "categoryName": "Phụ Kiện & Đất Trồng",
      "parentId": null,
      "quantity": 40,
      "sl": 40,
      "createdAt": "2026-01-10T00:00:00.000Z",
      "updatedAt": "2026-09-18T00:00:00.000Z"
    }
  ],
  "summary": {
    "khacCount": 12
  }
}
```

> **Lưu ý về trường `summary.khacCount`:**
> Đây là số lượng sản phẩm **chưa được gắn danh mục** (tức `categoryId` bằng `null`, `0` hoặc không tồn tại). Bạn có thể dùng chỉ số này để hiển thị mục *"Khác / Chưa phân loại"* trên giao diện nếu cần.

---

## 5. CHI TIẾT CÁC API SẢN PHẨM (PRODUCT APIS)

### 5.1. Lấy danh sách sản phẩm (Phân trang, Lọc & Tìm kiếm)
Phù hợp nhất cho trang danh mục sản phẩm, trang chủ, bộ lọc của shop online.

- **Phương thức:** `GET`
- **Đường dẫn:** `/products`
- **Xác thực:** Yêu cầu Bearer Token

#### Tham số Query Parameters (URL Query):
| Tham số | Kiểu | Mặc định | Ý nghĩa |
| :--- | :--- | :---: | :--- |
| `page` | `integer` | `1` | Trang hiện tại (bắt đầu từ 1) |
| `limit` | `integer` | `15` | Số lượng sản phẩm mỗi trang (tối đa 100) |
| `q` | `string` | `undefined` | **Tìm kiếm thông minh:** Tìm theo mã (`ma`), tên (`ten`), mã vạch (`barcode`). **Hỗ trợ tiếng Việt không dấu** (ví dụ: gõ `chau cay` tìm được `Chậu cây`) |
| `categoryId` | `string/number` | `undefined` | Lọc theo ID danh mục sản phẩm |
| `stock` | `string` | `'all'` | Lọc theo tình trạng tồn kho:<br>• `'all'`: Tất cả<br>• `'con'`: Còn hàng (`ton > 0`)<br>• `'het'`: Hết hàng (`ton <= 0`) |
| `productType` | `integer` | `undefined` | Lọc theo loại sản phẩm (`1`: hàng chuẩn, `2`: combo, `3`: dịch vụ) |
| `tags` | `string` | `undefined` | Lọc theo tags, ngăn cách bởi dấu phẩy: `banchay,moi,khuyenmai` |
| `sortBy` | `string` | `'createdAt'` | Trường sắp xếp: `giaWeb`, `giaBan`, `ton`, `ten`, `ma`, `createdAt` |
| `sortOrder` | `string` | `'desc'` | Thứ tự sắp xếp: `'asc'` (tăng dần) hoặc `'desc'` (giảm dần) |

#### Ví dụ Request:
```http
GET /api/products?page=1&limit=20&stock=con&categoryId=1001&sortBy=giaWeb&sortOrder=asc HTTP/1.1
Host: localhost:5000
Authorization: Bearer <TOKEN>
```

#### Ví dụ Response (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "_id": "673c123456789abcdef01234",
      "ma": "CC-MONST-01",
      "ten": "Chậu cây Monstera Deliciosa Lá Xẻ",
      "fullName": "Chậu cây Monstera Deliciosa Lá Xẻ Kèm Chậu Đất Nung 25cm",
      "barcode": "8935001234567",
      "dvt": "chậu",
      "productType": 1,
      "ton": 48,
      "tonMin": 5,
      "tonMax": 100,
      "giaBan": 280000,
      "giaChung": 280000,
      "giaSi": 190000,
      "giaWeb": 250000,
      "giaTruocGiam": 320000,
      "categoryId": 1001,
      "categoryName": "Chậu Cây Cảnh",
      "thuongHieu": "Aloha Garden",
      "allowsSale": true,
      "description": "Cây trầu bà lá xẻ Nam Mỹ phát triển tốt trong bóng râm...",
      "images": [
        "https://cdn.alohathegioichaucay.vn/images/monstera-1.jpg",
        "https://cdn.alohathegioichaucay.vn/images/monstera-2.jpg"
      ],
      "attributes": [
        { "attributeName": "Kích thước", "attributeValue": "Cao 60cm" },
        { "attributeName": "Chất liệu chậu", "attributeValue": "Đất nung" }
      ],
      "ancestor": [
        { "id": 1000, "name": "Cây Cảnh" }
      ],
      "createdAt": "2026-03-15T08:30:00.000Z",
      "updatedAt": "2026-09-18T02:15:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 142,
    "totalPages": 8
  },
  "summary": {
    "totalStock": 3840
  }
}
```

---

### 5.2. Tìm kiếm nhanh sản phẩm (Autocomplete / Search Box)
Dùng cho thanh tìm kiếm nhanh (Header Search Bar) với độ trễ cực thấp.

- **Phương thức:** `GET`
- **Đường dẫn:** `/products/search`
- **Xác thực:** Yêu cầu Bearer Token

#### Tham số Query Parameters:
| Tham số | Kiểu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `q` | `string` | **Có** | Từ khóa tìm kiếm (hỗ trợ tiếng Việt không dấu, tìm trên mã, tên, barcode) |
| `limit` | `integer` | Không | Số lượng kết quả tối đa (mặc định: `20`) |

#### Ví dụ Request:
```http
GET /api/products/search?q=chau%20cay&limit=5 HTTP/1.1
Host: localhost:5000
Authorization: Bearer <TOKEN>
```

#### Ví dụ Response (200 OK):
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "_id": "673c1234...",
      "ma": "CC-MONST-01",
      "ten": "Chậu cây Monstera Deliciosa",
      "dvt": "chậu",
      "ton": 48,
      "giaWeb": 250000,
      "giaBan": 280000,
      "images": ["https://cdn.alohathegioichaucay.vn/images/monstera-1.jpg"]
    },
    {
      "_id": "673c5678...",
      "ma": "CC-KIMTIEN-02",
      "ten": "Chậu cây Kim Tiền Phong Thủy",
      "dvt": "chậu",
      "ton": 15,
      "giaWeb": 190000,
      "giaBan": 210000,
      "images": ["https://cdn.alohathegioichaucay.vn/images/kimtien-1.jpg"]
    }
  ]
}
```

---

### 5.3. Lấy chi tiết 1 sản phẩm theo mã SKU
Dùng cho trang Chi tiết sản phẩm (`/san-pham/:ma`).

- **Phương thức:** `GET`
- **Đường dẫn:** `/products/:ma`
- **Xác thực:** Yêu cầu Bearer Token
- **Tham số Path:** `ma` (ví dụ: `CC-MONST-01`, `HG15X10X10`)

#### Ví dụ Request:
```http
GET /api/products/CC-COMBO-01 HTTP/1.1
Host: localhost:5000
Authorization: Bearer <TOKEN>
```

#### Ví dụ Response (200 OK - Trường hợp Sản phẩm Combo):
```json
{
  "success": true,
  "data": {
    "_id": "673c999999999abcdef01234",
    "ma": "CC-COMBO-01",
    "ten": "Set Combo Ban Công Xanh 3 Cây Kèm Chậu",
    "productType": 2,
    "ton": 10,
    "giaBan": 550000,
    "giaChung": 550000,
    "giaWeb": 490000,
    "giaTruocGiam": 650000,
    "categoryId": 1001,
    "categoryName": "Combo Ưu Đãi",
    "images": [
      "https://cdn.alohathegioichaucay.vn/images/combo-bancong.jpg"
    ],
    "hangThanhPhan": [
      {
        "ma": "CC-MONST-01",
        "ten": "Chậu cây Monstera",
        "dvt": "chậu",
        "soLuong": 1,
        "giaVon": 120000,
        "giaBan": 250000
      },
      {
        "ma": "CC-LUOIHO-01",
        "ten": "Chậu cây Lưỡi Hổ Viền Vàng",
        "dvt": "chậu",
        "soLuong": 2,
        "giaVon": 70000,
        "giaBan": 150000
      }
    ],
    "description": "Combo ban công tiện lợi bao gồm 1 chậu Monstera và 2 chậu Lưỡi hổ lọc không khí...",
    "allowsSale": true
  }
}
```

---

### 5.4. Lấy danh sách sản phẩm theo Category ID
Dùng khi người dùng bấm vào một danh mục cụ thể trên menu.

- **Phương thức:** `GET`
- **Đường dẫn:** `/products/category/:categoryId`
- **Xác thực:** Yêu cầu Bearer Token
- **Tham số Path:** `categoryId` (số nguyên, ví dụ: `1001`)

#### Ví dụ Request:
```http
GET /api/products/category/1001 HTTP/1.1
Host: localhost:5000
Authorization: Bearer <TOKEN>
```

#### Ví dụ Response (200 OK):
```json
{
  "success": true,
  "count": 35,
  "data": [
    {
      "ma": "CC-MONST-01",
      "ten": "Chậu cây Monstera Deliciosa",
      "ton": 48,
      "giaWeb": 250000,
      "images": ["https://..."]
    }
  ]
}
```

---

### 5.5. Lấy danh sách sản phẩm dưới định mức tồn an toàn (Cảnh báo hết hàng)
- **Phương thức:** `GET`
- **Đường dẫn:** `/products/below-min-stock`
- **Xác thực:** Yêu cầu Bearer Token

#### Ví dụ Response (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "ma": "CC-SENDA-05",
      "ten": "Sen Đá Kim Cương",
      "ton": 2,
      "tonMin": 10,
      "giaBan": 45000
    }
  ]
}
```

---

### 5.6. Cập nhật thông tin sản phẩm
- **Phương thức:** `PUT`
- **Đường dẫn:** `/products/:ma`
- **Xác thực:** Yêu cầu Bearer Token

#### Request Body mẫu:
```json
{
  "giaWeb": 235000,
  "giaTruocGiam": 300000,
  "description": "<p>Mô tả cập nhật mới cho chương trình Flash Sale</p>",
  "images": [
    "https://cdn.alohathegioichaucay.vn/images/sp-new-1.jpg"
  ]
}
```

---

### 5.7. Đồng bộ tức thì sản phẩm từ KiotViet (Sync on-demand)
- **Phương thức:** `POST`
- **Đường dẫn:** `/products/sync-kiotviet/:ma`
- **Xác thực:** Yêu cầu Bearer Token (Quyền `admin` hoặc `manager`)

#### Response (200 OK):
```json
{
  "success": true,
  "message": "Đồng bộ thành công sản phẩm từ KiotViet",
  "data": {
    "code": "HG15X10X10",
    "name": "Hộp Carton 15x10x10",
    "price": 3500,
    "onHand": 2500
  }
}
```

---

## 6. HƯỚNG DẪN DỰNG CÂY DANH MỤC ĐA CẤP (CATEGORY TREE HIERARCHY)

Trong cơ sở dữ liệu, các danh mục được trả về dưới dạng **danh sách phẳng (Flat Array)** có `categoryId` và `parentId`. 
Để hiển thị lên thanh Menu đa cấp (Level 1, Level 2, Level 3) trên trang web shop, bạn sử dụng hàm dựng cây đệ quy đơn giản sau:

```typescript
export interface ICategoryItem {
  _id?: string;
  categoryId: number;
  categoryName: string;
  parentId?: number | null;
  quantity?: number;
  sl?: number;
}

export interface ICategoryTreeNode extends ICategoryItem {
  children: ICategoryTreeNode[];
}

/**
 * Thuật toán O(N) chuyển mảng phẳng danh mục thành cấu trúc Cây Menu đa cấp
 */
export function buildCategoryTree(categories: ICategoryItem[]): ICategoryTreeNode[] {
  const nodeMap = new Map<number, ICategoryTreeNode>();
  const rootNodes: ICategoryTreeNode[] = [];

  // Bước 1: Tạo map với danh sách con rỗng
  for (const cat of categories) {
    nodeMap.set(cat.categoryId, {
      ...cat,
      children: [],
    });
  }

  // Bước 2: Ghép các nút con vào nút cha tương ứng
  for (const cat of categories) {
    const currentNode = nodeMap.get(cat.categoryId)!;
    if (cat.parentId && nodeMap.has(cat.parentId)) {
      const parentNode = nodeMap.get(cat.parentId)!;
      parentNode.children.push(currentNode);
    } else {
      // parentId là null hoặc không tìm thấy cha -> coi là Danh mục cấp 1 (Root)
      rootNodes.push(currentNode);
    }
  }

  return rootNodes;
}
```

---

## 7. BỘ TYPESCRIPT INTERFACES ĐẦY ĐỦ (DÙNG NGAY)

```typescript
// ================= DANH MỤC =================
export interface ICategoryItem {
  _id?: string;
  categoryId: number;
  categoryName: string;
  parentId?: number | null;
  quantity?: number;
  sl?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ICategoryResponse {
  success: boolean;
  count: number;
  data: ICategoryItem[];
  summary?: {
    khacCount?: number;
  };
}

// ================= SẢN PHẨM =================
export interface IProductAttribute {
  attributeName?: string;
  attributeValue?: string;
}

export interface IHangThanhPhan {
  ma: string;
  ten: string;
  dvt?: string;
  soLuong: number;
  giaBan?: number;
}

export interface IProductItem {
  _id: string;
  ma: string;
  ten: string;
  fullName?: string;
  barcode?: string;
  dvt?: string;
  productType?: 1 | 2 | 3; // 1: lẻ, 2: combo, 3: dịch vụ
  ton: number;
  tonMin?: number;
  giaBan: number;
  giaChung?: number;
  giaSi?: number;
  giaWeb: number;
  giaTruocGiam?: number;
  categoryId?: number;
  categoryName?: string;
  thuongHieu?: string;
  allowsSale?: boolean;
  description?: string;
  images: string[];
  videos?: string[];
  attributes?: IProductAttribute[];
  hangThanhPhan?: IHangThanhPhan[];
  createdAt?: string;
  updatedAt?: string;
}

export interface IProductListResponse {
  success: boolean;
  data: IProductItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary?: {
    totalStock?: number;
  };
}

export interface IProductDetailResponse {
  success: boolean;
  data: IProductItem;
}
```

---

## 8. CODE MẪU CLIENT GỌI API (FETCH API HOÀN CHỈNH)

```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

/**
 * 1. Lấy toàn bộ danh mục sản phẩm (kèm cache)
 */
export async function fetchCategories(token?: string): Promise<ICategoryItem[]> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}/categories`, {
    method: 'GET',
    headers,
    next: { revalidate: 300 } // Cache 5 phút (Next.js)
  });

  if (!res.ok) throw new Error(`Lỗi tải danh mục: ${res.statusText}`);
  const json: ICategoryResponse = await res.json();
  return json.data || [];
}

/**
 * 2. Lấy danh sách sản phẩm cho trang Shop / Danh mục
 */
export async function fetchShopProducts(params: {
  page?: number;
  limit?: number;
  q?: string;
  categoryId?: number | string;
  stock?: 'all' | 'con' | 'het';
  sortBy?: 'giaWeb' | 'giaBan' | 'createdAt' | 'ton';
  sortOrder?: 'asc' | 'desc';
  token?: string;
}): Promise<IProductListResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.q?.trim()) query.set('q', params.q.trim());
  if (params.categoryId) query.set('categoryId', String(params.categoryId));
  if (params.stock) query.set('stock', params.stock);
  if (params.sortBy) query.set('sortBy', params.sortBy);
  if (params.sortOrder) query.set('sortOrder', params.sortOrder);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (params.token) headers['Authorization'] = `Bearer ${params.token}`;

  const res = await fetch(`${API_BASE_URL}/products?${query.toString()}`, {
    method: 'GET',
    headers,
    next: { revalidate: 60 },
  });

  if (!res.ok) throw new Error(`Lỗi tải danh sách sản phẩm: ${res.statusText}`);
  return res.json();
}

/**
 * 3. Lấy chi tiết sản phẩm theo mã SKU
 */
export async function fetchProductDetail(
  ma: string,
  token?: string
): Promise<IProductItem | null> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}/products/${encodeURIComponent(ma)}`, {
    method: 'GET',
    headers,
  });

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Lỗi tải chi tiết sản phẩm ${ma}`);

  const json: IProductDetailResponse = await res.json();
  return json.data;
}

/**
 * 4. Tìm kiếm nhanh sản phẩm (Header Autocomplete)
 */
export async function searchProductsQuick(
  keyword: string,
  limit = 10,
  token?: string
): Promise<IProductItem[]> {
  if (!keyword.trim()) return [];

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const query = new URLSearchParams({
    q: keyword.trim(),
    limit: String(limit),
  });

  const res = await fetch(`${API_BASE_URL}/products/search?${query.toString()}`, {
    method: 'GET',
    headers,
  });

  if (!res.ok) return [];
  const json = await res.json();
  return json.data || [];
}
```

---

## 9. CÁC MÃ TRẠNG THÁI HTTP (HTTP STATUS CODES)

| Mã lỗi | Trạng thái | Ý nghĩa | Cách xử lý cho Client |
| :---: | :--- | :--- | :--- |
| `200` | **OK** | Yêu cầu thành công, dữ liệu trả về trong `data` | Render dữ liệu |
| `400` | **Bad Request** | Tham số không hợp lệ (ví dụ thiếu `?q=` khi gọi `/search`) | Kiểm tra lại query params / body |
| `401` | **Unauthorized** | Thiếu Token hoặc Token JWT đã hết hạn | Điều hướng người dùng tới trang đăng nhập hoặc làm mới token |
| `403` | **Forbidden** | Tài khoản không có quyền thao tác | Hiển thị thông báo không đủ quyền |
| `404` | **Not Found** | Không tìm thấy mã sản phẩm yêu cầu | Hiển thị trang 404 hoặc thông báo "Sản phẩm không tồn tại" |
| `500` | **Internal Server Error** | Lỗi máy chủ cơ sở dữ liệu | Thử lại sau hoặc báo quản trị viên |
