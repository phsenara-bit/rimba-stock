# Rimba Alam Mobile Stock App - Local Web Server
# Jalankan script ini untuk membuka aplikasi di PC dan di HP Android lewat Wi-Fi

$port = 8080
$folder = $PSScriptRoot
$url = "http://localhost:$port/"

# Cari IP lokal Wi-Fi / LAN untuk dibuka dari HP Android
$localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
    $_.InterfaceAlias -notmatch 'Loopback' -and 
    $_.IPAddress -notmatch '^169\.' -and 
    $_.IPAddress -notmatch '^127\.' 
} | Select-Object -First 1).IPAddress

$listener = New-Object System.Net.HttpListener
$boundToNetwork = $false

try {
    $listener.Prefixes.Add("http://*:$port/")
    $listener.Start()
    $boundToNetwork = $true
} catch {
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://localhost:$port/")
    $listener.Prefixes.Add("http://127.0.0.1:$port/")
    if ($localIP) {
        try {
            $listener.Prefixes.Add("http://$($localIP):$port/")
            $boundToNetwork = $true
        } catch {}
    }
    try {
        $listener.Start()
    } catch {
        # Fallback minimal
        $listener = New-Object System.Net.HttpListener
        $listener.Prefixes.Add("http://localhost:$port/")
        $listener.Start()
    }
}

Write-Host "==========================================================" -ForegroundColor Green
Write-Host " [OK] RIMBA ALAM MOBILE APP BERJALAN!" -ForegroundColor Cyan
Write-Host " Buka di Komputer:  http://localhost:$port/" -ForegroundColor Yellow
if ($localIP) {
    Write-Host " Buka di HP Android: http://$($localIP):$port/" -ForegroundColor Green
}
Write-Host "==========================================================" -ForegroundColor Green
Write-Host " Tekan CTRL + C untuk menghentikan server." -ForegroundColor Gray

# Buka otomatis di browser
Start-Process $url

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $relPath = $request.Url.LocalPath.TrimStart('/')
        if ([string]::IsNullOrWhiteSpace($relPath)) {
            $relPath = "index.html"
        }

        $fullPath = Join-Path $folder $relPath.Replace('/', '\')

        if (Test-Path $fullPath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($fullPath)
            $ext = [System.IO.Path]::GetExtension($fullPath).ToLower()

            $contentType = switch ($ext) {
                ".html" { "text/html; charset=utf-8" }
                ".css"  { "text/css; charset=utf-8" }
                ".js"   { "application/javascript; charset=utf-8" }
                ".json" { "application/json; charset=utf-8" }
                ".png"  { "image/png" }
                ".jpg"  { "image/jpeg" }
                ".svg"  { "image/svg+xml" }
                default { "application/octet-stream" }
            }

            $response.ContentType = $contentType
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $errBytes = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
        }
        $response.Close()
    }
}
finally {
    $listener.Stop()
}
