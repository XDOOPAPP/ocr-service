# OCR Service Management Script for Windows
# Usage: .\manage.ps1 <command>

param(
    [Parameter(Position=0)]
    [string]$Command = "help"
)

function Show-Help {
    Write-Host "OCR Service Management Commands:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  start       - Start all services" -ForegroundColor Green
    Write-Host "  stop        - Stop all services" -ForegroundColor Yellow
    Write-Host "  restart     - Restart all services" -ForegroundColor Blue
    Write-Host "  logs        - View logs (follow mode)" -ForegroundColor Magenta
    Write-Host "  ps          - Show running services" -ForegroundColor White
    Write-Host "  migrate     - Run Prisma migration" -ForegroundColor Cyan
    Write-Host "  studio      - Open Prisma Studio" -ForegroundColor Green
    Write-Host "  shell       - Open shell in OCR service container" -ForegroundColor Yellow
    Write-Host "  clean       - Stop and remove volumes (⚠️  deletes data)" -ForegroundColor Red
    Write-Host "  rebuild     - Rebuild and restart services" -ForegroundColor Blue
    Write-Host "  help        - Show this help message" -ForegroundColor White
    Write-Host ""
}

function Start-Services {
    Write-Host "🚀 Starting OCR Service..." -ForegroundColor Cyan
    docker-compose up -d
    Write-Host "✅ Services started!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Status:" -ForegroundColor Cyan
    docker-compose ps
}

function Stop-Services {
    Write-Host "🛑 Stopping OCR Service..." -ForegroundColor Yellow
    docker-compose down
    Write-Host "✅ Services stopped!" -ForegroundColor Green
}

function Restart-Services {
    Write-Host "🔄 Restarting OCR Service..." -ForegroundColor Blue
    docker-compose restart
    Write-Host "✅ Services restarted!" -ForegroundColor Green
}

function Show-Logs {
    Write-Host "📋 Showing logs (Ctrl+C to exit)..." -ForegroundColor Magenta
    docker-compose logs -f
}

function Show-Status {
    Write-Host "📊 Service Status:" -ForegroundColor Cyan
    docker-compose ps
}

function Run-Migration {
    Write-Host "🔧 Running Prisma migration..." -ForegroundColor Cyan
    docker-compose exec ocr-service npx prisma generate
    docker-compose exec ocr-service npx prisma db push
    Write-Host "✅ Migration completed!" -ForegroundColor Green
}

function Open-Studio {
    Write-Host "🎨 Opening Prisma Studio..." -ForegroundColor Green
    Write-Host "Access at: http://localhost:5555" -ForegroundColor Yellow
    docker-compose exec ocr-service npx prisma studio
}

function Open-Shell {
    Write-Host "🐚 Opening shell in OCR service container..." -ForegroundColor Yellow
    docker-compose exec ocr-service sh
}

function Clean-All {
    Write-Host "⚠️  WARNING: This will delete all data!" -ForegroundColor Red
    $confirm = Read-Host "Are you sure? (yes/no)"
    if ($confirm -eq "yes") {
        Write-Host "🧹 Cleaning up..." -ForegroundColor Red
        docker-compose down -v
        Write-Host "✅ Cleanup completed!" -ForegroundColor Green
    } else {
        Write-Host "❌ Cancelled" -ForegroundColor Yellow
    }
}

function Rebuild-Services {
    Write-Host "🔨 Rebuilding services..." -ForegroundColor Blue
    docker-compose up -d --build
    Write-Host "✅ Rebuild completed!" -ForegroundColor Green
}

# Main command router
switch ($Command.ToLower()) {
    "start" { Start-Services }
    "stop" { Stop-Services }
    "restart" { Restart-Services }
    "logs" { Show-Logs }
    "ps" { Show-Status }
    "migrate" { Run-Migration }
    "studio" { Open-Studio }
    "shell" { Open-Shell }
    "clean" { Clean-All }
    "rebuild" { Rebuild-Services }
    "help" { Show-Help }
    default {
        Write-Host "❌ Unknown command: $Command" -ForegroundColor Red
        Write-Host ""
        Show-Help
    }
}
