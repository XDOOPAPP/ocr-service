# 🚀 Hướng dẫn Test OCR Service (Siêu nhanh)

Tài liệu này hướng dẫn cách chạy và test OCR Service từ lúc mới clone code về.

> **✨ Tính năng mới: QR Code Scanning**  
> Service hiện hỗ trợ quét mã QR trên hóa đơn điện tử Việt Nam với độ chính xác cao (~98%).  
> **QR-first approach**: Ưu tiên quét QR trước, nếu không tìm thấy mới fallback sang OCR text.

## 1. Khởi chạy hệ thống (Docker)

Mở terminal và chạy theo thứ tự:

```powershell
# B1: Chạy hạ tầng (Database, RabbitMQ)
cd deployment
docker-compose up -d

# B2: Chạy API Gateway & Auth Service (Để lấy Login/Token)
cd ../api-gateway
docker-compose up -d

# B3: Chạy OCR Service (Docker sẽ tự động npm install)
cd ../ocr-service
docker-compose up -d --build
```

> **💡 Lưu ý:** Dockerfile đã có `npm install`, không cần chạy tay khi dùng Docker!

---

## 2. Khởi tạo Database (BẮT BUỘC)

Sau khi container đã chạy, bạn cần tạo bảng trong database:

```powershell
# Tạo bảng trong Database
docker exec -it ocr-service npx prisma migrate deploy
docker exec -it ocr-service npx prisma db push
```

---

## 3. Test trên Postman

### Bước 1: Lấy Token (Login)
*   **Method:** `POST`
*   **URL:** `http://localhost:3000/api/v1/user/login`
*   **Body (JSON):**
    ```json
    {
      "email": "admin@fepa.com",
      "password": "admin123"
    }
    ```
*   **Kết quả:** Copy chuỗi `access_token` trả về.

### Bước 2: Quét hóa đơn (Scan OCR/QR)
*   **Method:** `POST`
*   **URL:** `http://localhost:3000/api/v1/ocr/scan`
*   **Headers:** `Authorization`: `Bearer <Token>`
*   **Body (JSON):**
    ```json
    {
      "fileUrl": "https://example.com/invoice.jpg"
    }
    ```

**Lưu ý về xử lý:**
- ✅ Nếu ảnh có **QR code hóa đơn điện tử VN** → Trích xuất dữ liệu từ QR (độ chính xác ~98%)
- ✅ Nếu không tìm thấy QR → Tự động fallback sang OCR text recognition
- ✅ Kết quả trả về sẽ có field `source`: `"qr"`, `"ocr"`, hoặc `"hybrid"`

### Bước 3: Xem lịch sử quét (History)
*   **Method:** `GET`
*   **URL:** `http://localhost:3000/api/v1/ocr/jobs`
*   **Headers:** `Authorization`: `Bearer <Token>`

### Bước 4: Xem chi tiết một Job
*   **Method:** `GET`
*   **URL:** `http://localhost:3000/api/v1/ocr/jobs/<JOB_ID>`
*   **Headers:** `Authorization`: `Bearer <Token>`

**Kết quả trả về sẽ bao gồm:**
```json
{
  "id": "...",
  "status": "completed",
  "resultJson": {
    "hasQrCode": true,
    "qrData": {
      "rawData": "...",
      "parsedData": {
        "invoiceNumber": "0000123",
        "sellerName": "CÔNG TY ABC",
        "totalPayment": 1100000
      }
    },
    "expenseData": {
      "amount": 1100000,
      "description": "CÔNG TY ABC - 0000123",
      "source": "qr",
      "confidence": 98
    }
  }
}
```

---

## 💡 Lưu ý quan trọng

### Về QR Code
*   **Định dạng hỗ trợ:** Hóa đơn điện tử Việt Nam (theo chuẩn Tổng cục Thuế)
*   **Dữ liệu trích xuất:** Số hóa đơn, Tên người bán, Tổng tiền, Ngày hóa đơn, MST...
*   **Độ chính xác:** ~98% (cao hơn nhiều so với OCR text ~70-85%)

### Về OCR Fallback
*   **Khi nào dùng:** Ảnh không có QR hoặc QR không đúng định dạng
*   **Ngôn ngữ hỗ trợ:** Tiếng Anh + Tiếng Việt
*   **Độ chính xác:** Phụ thuộc vào chất lượng ảnh (70-85%)

### Troubleshooting
*   **Lỗi 500:** Nếu gặp lỗi này, hãy chạy lệnh `docker logs ocr-service` để xem lỗi.
*   **Lỗi "Cannot find module 'jsqr'":** Chạy `npm install` trong thư mục `ocr-service`
*   **Cổng kết nối:** 
    *   API Gateway: `3000` (Sử dụng để test tập trung).
    *   RabbitMQ: `http://localhost:15672` (fepa/fepa123).
