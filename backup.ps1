# Configuración - REEMPLAZA con tus datos reales
$password = "qzMxdk9UnrS4QkD2"
$projectRef = "dknomqgzmnlakpskeety"
$fecha = Get-Date -Format "yyyyMMdd_HHmm"
$archivo = "backup_completo_$fecha.sql"

docker run --rm -v ${PWD}:/tmp postgres:15 pg_dump "postgresql://postgres:$password@db.$projectRef.supabase.co:5432/postgres" -f "/tmp/backup_completo_$fecha.sql"