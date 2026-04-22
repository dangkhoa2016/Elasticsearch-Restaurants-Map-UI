# Elasticsearch Restaurants Map UI

> 🌐 Language / Ngôn ngữ: [English](readme.md) | **Tiếng Việt**

Một ứng dụng single-page tĩnh cho phép người dùng tìm kiếm các nhà hàng gần đó trên Google Maps tương tác. Ứng dụng sử dụng truy vấn geo-distance được cung cấp bởi REST API chạy trên Elasticsearch, sau đó hiển thị kết quả dưới dạng marker tương tác với clustering, popup thông tin và danh sách có thể lọc/sắp xếp.

---

## Tính năng

- **Tìm kiếm theo địa chỉ** bằng Google Places Autocomplete, có giới hạn theo quốc gia
- Nút **"Dùng vị trí của tôi"** thông qua Geolocation API của trình duyệt, kèm reverse geocoding
- **Nhấp hoặc kéo** marker trên bản đồ để đặt điểm tìm kiếm tuỳ chỉnh
- Kiểu vùng tìm kiếm **Hình tròn** (bán kính) và **Hình chữ nhật** (chiều ngang × chiều dọc)
- **Hỗ trợ nhiều đơn vị khoảng cách**: mét, kilômét, dặm, feet
- **Gộp marker** bằng `@googlemaps/markerclusterer`
- **Danh sách kết quả** (offcanvas) với:
  - Lọc theo tên hoặc mô tả
  - Sắp xếp theo khoảng cách (gần/xa) hoặc tên (A-Z / Z-A)
  - Huy hiệu khoảng cách bên cạnh từng kết quả
- **Yêu thích** — lưu/xoá nhà hàng, được lưu trong `localStorage`
- **Lịch sử tìm kiếm** — lưu tối đa 8 lần tìm gần nhất trong `localStorage`
- **Chia sẻ / deep-link** — sao chép URL để khôi phục trạng thái tìm kiếm hiện tại
- Có thể **cấu hình** số lượng kết quả tối đa (mặc định 80), tên index, tâm bản đồ, icon và quốc gia cho autocomplete
- **Không cần bước build** — HTML + CSS + JavaScript thuần, phục vụ như các file tĩnh

---

## Công nghệ sử dụng

| Tầng | Công nghệ |
|---|---|
| UI framework | [Bootstrap 5.2.3](https://getbootstrap.com/) + [Bootstrap Icons 1.7.1](https://icons.getbootstrap.com/) |
| DOM / AJAX | [jQuery 3.6.3](https://jquery.com/) |
| Bản đồ | [Google Maps JavaScript API](https://developers.google.com/maps/documentation/javascript) (thư viện: `geometry`, `places`) |
| Gộp marker | [@googlemaps/markerclusterer](https://github.com/googlemaps/js-markerclusterer) |
| Lưu trữ | `localStorage` của trình duyệt (yêu thích, lịch sử tìm kiếm) |
| Phục vụ tệp | Bất kỳ static file server nào (không cần Node/build tooling) |

---

## Backend API

Giao diện gửi các request tìm kiếm geo-distance tới `endpoint` có thể cấu hình. Hiện có hai triển khai backend tương thích:

### Tuỳ chọn 1 — Node.js (Fastify + OpenSearch/Elasticsearch)
> **Repo:** [github.com/dangkhoa2016/Elasticsearch-Restaurants-Api-Nodejs](https://github.com/dangkhoa2016/Elasticsearch-Restaurants-Api-Nodejs)

Một REST API xây dựng trên Fastify, đóng vai trò lớp bao quanh cụm Elasticsearch / OpenSearch. Phù hợp cho các môi trường tự host hoặc triển khai trên cloud (VPS, Docker, Railway, Render, v.v.).

### Tuỳ chọn 2 — Cloudflare Worker (triển khai edge)
> **Repo:** [github.com/dangkhoa2016/Elasticsearch-Restaurants-Api-Cloudflare-Worker](https://github.com/dangkhoa2016/Elasticsearch-Restaurants-Api-Cloudflare-Worker)

Một edge API serverless triển khai trên Cloudflare Workers. Không có cold start, phân phối toàn cầu và thân thiện với free tier.

Cả hai backend đều cung cấp cùng một request/response contract và có thể thay thế cho nhau thông qua khoá cấu hình `endpoint`.

---

## Cấu hình

Cấu hình được tách thành hai file để các giá trị nhạy cảm khi chạy thực tế (API key, endpoint) không nằm trong phần mặc định dùng chung.

### `assets/js/config.js`
Định nghĩa các giá trị mặc định dùng chung và hàm hợp nhất `createElasticsearchRestaurantsConfig`. **Không chỉnh sửa** file này bằng các giá trị dành riêng cho từng môi trường.

| Khoá | Mặc định | Mô tả |
|---|---|---|
| `indexName` | `restaurants` | Tên index Elasticsearch |
| `mapCenter` | `[-37.840935, 144.946457]` | Tâm bản đồ ban đầu (Melbourne, VIC, AU) |
| `googleMapsApiKey` | `''` | API key cho Google Maps |
| `googleMapsLibraries` | `['geometry', 'places']` | Các thư viện Maps cần nạp |
| `maxSearchResults` | `80` | Số lượng kết quả tối đa trả về cho mỗi lần tìm |
| `autocompleteCountryRestriction` | `'au'` | Mã quốc gia ISO 3166-1 alpha-2 dùng cho Places Autocomplete |
| `markerIcon` | `/assets/imgs/marker-x64.png` | Icon marker tuỳ chỉnh trên bản đồ |
| `restaurantIcons` | *(3 đường dẫn PNG)* | Bộ icon marker nhà hàng (luân phiên theo kết quả) |
| `fallbackRestaurantPhoto` | `/assets/imgs/placeholder.png` | Ảnh hiển thị khi nhà hàng không có hình |

### `assets/js/runtime-config.js`
Ghi đè bất kỳ khoá nào ở trên cho một môi trường cụ thể. **File này được gitignore.** Một mẫu cấu hình được cung cấp tại `assets/js/runtime-config.example.js`.

```js
window.ELASTICSEARCH_RESTAURANTS_CONFIG = window.createElasticsearchRestaurantsConfig({
  endpoint: 'https://your-api-host.example.com',
  googleMapsApiKey: 'YOUR_GOOGLE_MAPS_API_KEY',
});
```

---

## Bắt đầu

### Điều kiện tiên quyết
- Một backend API đang chạy (xem [Backend API](#backend-api) ở trên)
- Một [Google Maps API key](https://developers.google.com/maps/documentation/javascript/get-api-key) đã bật **Maps JavaScript API** và **Places API**

### Thiết lập local

```bash
# Clone repository
git clone https://github.com/dangkhoa2016/Elasticsearch-Restaurants-Map-UI.git
cd Elasticsearch-Restaurants-Map-UI

# Sao chép file mẫu runtime config và điền giá trị của bạn
cp assets/js/runtime-config.example.js assets/js/runtime-config.js
# Chỉnh runtime-config.js: đặt endpoint và googleMapsApiKey

# Serve thư mục bằng bất kỳ static server nào, ví dụ:
npx serve .
# hoặc
python3 -m http.server 8000
```

Mở `http://localhost:8000` (hoặc cổng được hiển thị) trong trình duyệt.

> **Lưu ý:** Ứng dụng dùng `fetch()` để nạp các HTML partial khi khởi động, nên bắt buộc phải được phục vụ qua HTTP/HTTPS. Mở trực tiếp `index.html` bằng URL `file://` sẽ không hoạt động.

### Replit

Repository đi kèm file cấu hình `.replit`. Hãy import repo vào [Replit](https://replit.com/), đặt `endpoint` và `googleMapsApiKey` trong `assets/js/runtime-config.js`, rồi bấm **Run**.

---

## Địa điểm Demo / Test

Hai trang hỗ trợ được đính kèm để giúp bạn nhanh chóng tìm các khu vực có nhiều nhà hàng demo khi test:

| File | Mô tả |
|---|---|
| [top_location_with_many_restaurants_for_test.html](top_location_with_many_restaurants_for_test.html) | Danh sách địa chỉ (kèm tọa độ) tại các khu vực có nhiều nhà hàng demo. Click vào địa chỉ hoặc tọa độ để copy, sau đó dán vào ô tìm kiếm. |
| [reverse_geocoding_list.html](reverse_geocoding_list.html) | Sử dụng Google Maps Geocoding API để giải mã tọa độ thành địa chỉ đọc được theo thời gian thực. Cần có Google Maps API key. |

---

## Ghi chú bảo mật

- Chỉ lưu `googleMapsApiKey` trong `runtime-config.js`, file này đã được gitignore.
- **Giới hạn Google Maps key** theo các HTTP referrer được phép (domain của bạn) trong [Google Cloud Console](https://console.cloud.google.com/) trước khi dùng ngoài môi trường local.
- Đặt `endpoint` thành URL backend API của bạn. Cấu hình CORS ở backend để chỉ cho phép origin của frontend.
- Tất cả tên và mô tả nhà hàng đều được escape HTML trước khi render vào DOM.
