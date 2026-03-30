# 🚔 Hệ Thống Bản Đồ Theo Dõi Đối Tượng (Tracking Map MVP)

Một giải pháp Web App chiến thuật (Tactical Web App) được phát triển nhằm mục đích theo dõi trực quan theo thời gian thực (Real-time tracking) các điểm nghi vấn và quá trình dịch chuyển của các đối tượng trộm cắp xe máy dọc theo tuyến đường **QL 6 (Tân Lạc - Cao Phong - Hòa Bình)** và các địa bàn lân cận.

---

## 1. Tổng Quan Dự Án (Project Overview)

Ứng dụng bản đồ hiện tại giúp lực lượng phòng chống tội phạm/hiệp sĩ dễ dàng ghi nhận, lưu trữ bằng chứng (ảnh/video từ nguồn tin) và mô hình hóa đường tẩu thoát của đối tượng bằng cách chấm các tọa độ lên hệ thống bản đồ số học. 

**Vấn đề giải quyết:**
- Hỗ trợ phân tích dữ liệu không gian ngay lập tức để phỏng đoán tốc độ và hướng di chuyển.
- Rút ngắn thời gian tương tác so với việc đọc văn bản tọa độ chay.
- Hình ảnh/Bằng chứng được liên kết chặt với một vị trí cụ thể (Geotagging) giúp dễ quản lý.

---

## 2. Kỹ Thuật Đã Áp Dụng (Current Tech Stack)

Hệ thống được thiết kế theo mô hình **Local-first (Máy chủ Cục bộ)** để đảm bảo bằng chứng không bị chia sẻ ra ngoài nếu không có chủ đích:

- **Frontend (Giao diện Bản đồ):**
  - Khung sườn: **React.js + Vite** (Mượt, nhẹ, đáp ứng tốt cho dashboard).
  - Bản đồ: **Leaflet.js** và **React-Leaflet** kết hợp với bộ Tile Layers của CARTO (chế độ ban đêm `dark_all` để tối ưu cho môi trường làm việc ban đêm).
  - Tự động cập nhật: Sử dụng kĩ thuật **Long-polling** (tự động làm mới 3 giây một lần) để bắt tín hiệu từ bộ đàm/dữ liệu vừa nhập mà không cần Refresh trình duyệt.

- **Backend (Máy chủ Dữ liệu):**
  - Ngôn ngữ & Framework: **Node.js, Express.js**.
  - Lưu trữ Dữ liệu: Ghi chép ngay lập tức bằng **JSON file** (`data.json`) kết hợp với hàm `.sort()` qua `timestamp` để nối sơ đồ tự động.
  - Lưu trữ Tệp (Media): **Multer** - Module chuyên biệt nhận luồng ảnh/video được gửi thẳng từ form báo cáo người dân và lưu cứng vào thư mục bảo mật `uploads/`.

---

## 3. Các Giải Pháp Mở Rộng Nâng Cao (Scaling & Expansion Solutions)

Hiện tại đây là phiên bản Nguyên mẫu (MVP). Để áp dụng cho một hệ thống quy mô lớn, liên tỉnh, chúng ta có thể mở rộng theo các góc độ quản lý và kĩ thuật sau:

### 3.1 Nâng cấp Luồng Dữ Liệu Thời Gian Thực (True Real-time)
- **WebSockets (Socket.io):** Thay vì Frontend phải "hỏi" Backend mỗi 3 giây (Polling), Backend sẽ chủ động kết nối và **đẩy (Push)** thẳng luồng tọa độ cho hàng ngàn trình duyệt đội viên đang mở máy ngay trong tích tắc (độ trễ ~0.01 giây) khi có dữ liệu báo mất.

### 3.2 Cơ Sở Dữ Liệu Không Gian (Spatial Database)
- Đổi từ file `JSON` sang thẳng **PostgreSQL** kết hợp phân hệ mã nguồn mở **PostGIS**.
- **Lợi ích:** Có thể chạy các câu lệnh truy vấn phức tạp như: *"Tìm toàn bộ đối tượng đã chạy ngang QL6 cách ngã ba này bán kính 5km trong thời gian 30 phút qua"*.

### 3.3 Tích Hợp Telegram Bot / Zalo Mini App
- Người đi đường, người dân mất xe thường mang theo điện thoại. Thay vì phải truy cập App/Web riêng, ta tạo một Bot Telegram/Zalo.
- **Quy trình:** Người dân mở Zalo -> Chọn "Báo án ghim vị trí hiện tại" -> Gửi 1 tấm ảnh xe bị mất -> Telegram Bot sẽ qua Webhook tự động tạo ra Điểm Đánh Dấu màu đỏ (Marker) chớp tắt trên bản đồ chính của Tổng Đài Điều Phối.

### 3.4 Camera Nhận Diện Biển Số Tự Động (AI LPR - License Plate Recognition)
- Nối API với các trạm camera phạt nguội/camera an ninh dọc QL 6. 
- Khi người bị mất xe nhập biển số (VD: `28H1-12345`) vào thẻ "Truy nã (Blacklist)". Bất cứ camera nào dọc đường quay trúng xe có biển số khớp với mẫu, camera sẽ bắn tự động API tạo một điểm màu đỏ tại cột điện đó trên bản đồ kèm khung hình xe đang chạy ngang qua. 

### 3.5 Công Nghệ Khoanh Vùng Cảnh Báo (Geofencing Alert)
- **Dự đoán hướng chạy ngõ cụt:** Từ tốc độ giữa Điểm 1 và Điểm 2, hệ thống dùng giải thuật để dự đoán Điểm 3. Bản đồ tự động highlight đỏ vòng tròn các khu vực đối tượng có thể đến trong 10 phút tiếp theo để đội hiệp sĩ tại cụm Cao Phong chuẩn bị chốt chặn trước.

---

> [!TIP]
> **Đóng góp Dự án:** File này là tài liệu kỹ thuật tổng quan. Việc triển khai các giải pháp mở rộng được khuyến khích phát triển sau khi đội nhóm đã làm quen với việc chấm tọa độ trên bản đồ.
