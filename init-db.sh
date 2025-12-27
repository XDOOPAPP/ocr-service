#!/bin/bash
set -e

# Create OCR database if it doesn't exist
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    SELECT 'CREATE DATABASE fepa_ocr'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'fepa_ocr')\gexec
    
    GRANT ALL PRIVILEGES ON DATABASE fepa_ocr TO fepa;
EOSQL

# Grant schema permissions for PostgreSQL 15+
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "fepa_ocr" <<-EOSQL
    GRANT ALL ON SCHEMA public TO fepa;
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO fepa;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO fepa;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO fepa;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO fepa;
EOSQL

echo "✅ OCR database created successfully!"
