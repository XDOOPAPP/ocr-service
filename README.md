# OCR Service - Docker Compose

Docker Compose setup để chạy OCR Service độc lập với PostgreSQL và RabbitMQ.

## 🚀 Quick Start

### 1. Tạo .env file
```bash
cp .env.example .env
```

### 2. Start services
```bash
docker-compose up -d
```

### 3. Run Prisma migration
```bash
# Wait for PostgreSQL to be ready
docker-compose exec ocr-service npx prisma generate
docker-compose exec ocr-service npx prisma db push
```

### 4. Verify
- **OCR Service**: http://localhost:3007
- **RabbitMQ UI**: http://localhost:15672 (fepa/fepa123)

---

## 📋 Services

| Service | Port | Description |
|---------|------|-------------|
| ocr-service | 3007 | OCR microservice |
| postgres | 5432 | PostgreSQL database |
| rabbitmq | 5672, 15672 | RabbitMQ message broker |

---

## 🔧 Development Mode

### Enable Hot Reload

1. Uncomment `command: npm run start:dev` in `docker-compose.yml`
2. Restart: `docker-compose restart ocr-service`

### View Logs
```bash
# All services
docker-compose logs -f

# OCR service only
docker-compose logs -f ocr-service
```

---

## 🧪 Testing

### With API Gateway

1. Start API Gateway separately:
   ```bash
   cd ../api-gateway
   docker-compose up -d
   ```

2. Test via API Gateway:
   ```bash
   # Get JWT token first
   POST http://localhost:3000/api/v1/auth/login
   
   # Create OCR job
   POST http://localhost:3000/api/v1/ocr/scan
   Authorization: Bearer YOUR_TOKEN
   {
     "fileUrl": "https://example.com/receipt.jpg"
   }
   ```

### Direct Testing (without API Gateway)

OCR service listens on RabbitMQ `ocr_queue`. You can send messages directly:

```javascript
// Using amqplib
const message = {
  pattern: 'ocr.scan',
  data: {
    fileUrl: 'https://example.com/receipt.jpg',
    userId: 'user-uuid'
  }
};
```

---

## 🗄️ Database

### Access PostgreSQL
```bash
# Via Docker
docker-compose exec postgres psql -U fepa -d fepa_ocr

# List tables
\dt

# View OcrJob table
SELECT * FROM "OcrJob";
```

### Prisma Studio
```bash
docker-compose exec ocr-service npx prisma studio
```

---

## 🛠️ Commands

### Start
```bash
docker-compose up -d
```

### Stop
```bash
docker-compose down
```

### Rebuild
```bash
docker-compose up -d --build
```

### Clean (remove volumes)
```bash
docker-compose down -v
```

### View Logs
```bash
docker-compose logs -f ocr-service
```

### Exec into container
```bash
docker-compose exec ocr-service sh
```

---

## 🔍 Troubleshooting

### Database Connection Error

**Problem**: `P1000: Authentication failed`

**Solution**:
1. Ensure PostgreSQL is running: `docker-compose ps postgres`
2. Check DATABASE_URL in `.env`
3. Recreate database:
   ```bash
   docker-compose down -v
   docker-compose up -d postgres
   # Wait 10 seconds
   docker-compose up -d ocr-service
   ```

### RabbitMQ Connection Error

**Problem**: Cannot connect to RabbitMQ

**Solution**:
1. Check RabbitMQ is healthy: `docker-compose ps rabbitmq`
2. View logs: `docker-compose logs rabbitmq`
3. Restart: `docker-compose restart rabbitmq`

### Prisma Migration Error

**Problem**: Tables not created

**Solution**:
```bash
docker-compose exec ocr-service npx prisma db push --force-reset
```

---

## 🌐 Network

Services communicate via `fepa-network`. To connect with other services:

```yaml
# In other service's docker-compose.yml
networks:
  fepa-network:
    external: true
```

Then start this service first to create the network.

---

## 📦 Volumes

- `postgres_data`: PostgreSQL data persistence
- `rabbitmq_data`: RabbitMQ data persistence

### Backup
```bash
docker run --rm -v ocr-service_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz -C /data .
```

### Restore
```bash
docker run --rm -v ocr-service_postgres_data:/data -v $(pwd):/backup alpine tar xzf /backup/postgres-backup.tar.gz -C /data
```

---

## 🔐 Security

**⚠️ For Production**:

1. Change credentials in `docker-compose.yml`:
   ```yaml
   environment:
     - POSTGRES_PASSWORD=your_secure_password
     - RABBITMQ_DEFAULT_PASS=your_secure_password
   ```

2. Update `.env`:
   ```env
   DATABASE_URL="postgresql://fepa:your_secure_password@postgres:5432/fepa_ocr"
   RABBITMQ_URL=amqp://fepa:your_secure_password@rabbitmq:5672
   ```

3. Don't expose ports publicly (remove port mappings or use firewall)

---

## 📚 Related Documentation

- [OCR Service Implementation](../OCR_SERVICE_IMPLEMENTATION.md)
- [Database Architecture](../DATABASE_ARCHITECTURE.md)
- [RabbitMQ Migration](../RABBITMQ_MIGRATION.md)
