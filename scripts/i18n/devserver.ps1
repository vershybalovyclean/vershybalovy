# Локальный сервер для проверки маршрутов: имитирует правила vercel.json (cleanUrls, trailingSlash:false, rewrites, redirects, 404.html с настоящим статусом 404).
# НЕ заменяет проверку на Vercel Preview. Порт 8091. Не деплоится (.vercelignore: /scripts/).
param([string]$Root = '', [int]$Port = 8091)
$root = if ($Root) { $Root } else { Split-Path (Split-Path $PSScriptRoot -Parent) -Parent }
$cfg = Get-Content (Join-Path $root 'vercel.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$mime = @{'.html'='text/html; charset=utf-8';'.css'='text/css';'.js'='application/javascript';'.json'='application/json';'.png'='image/png';'.jpg'='image/jpeg';'.jpeg'='image/jpeg';'.svg'='image/svg+xml';'.ico'='image/x-icon';'.webp'='image/webp';'.woff2'='font/woff2';'.xml'='application/xml';'.txt'='text/plain';'.mp4'='video/mp4'}
$l = New-Object System.Net.HttpListener; $l.Prefixes.Add("http://localhost:$Port/"); $l.Start()
function Send($res, $code, $ct, [byte[]]$b, $loc) { $res.StatusCode = $code; if ($ct) { $res.ContentType = $ct }; if ($loc) { $res.RedirectLocation = $loc }; $res.ContentLength64 = $b.Length; $res.OutputStream.Write($b,0,$b.Length) }
while ($l.IsListening) {
  $c = $l.GetContext(); $req = $c.Request; $res = $c.Response
  try {
    $p = [Uri]::UnescapeDataString($req.Url.AbsolutePath)
    if ($p.Length -gt 1 -and $p.EndsWith('/')) { Send $res 308 $null ([byte[]]@()) ($p.TrimEnd('/')); continue }
    $done = $false
    foreach ($r in $cfg.redirects) { if ($r.source -eq $p) { Send $res 308 $null ([byte[]]@()) $r.destination; $done = $true; break } }
    if ($done) { continue }
    if ($p -match '^/(uk|ru|en)/index$') { Send $res 308 $null ([byte[]]@()) ('/' + $Matches[1]); continue }
    if ($p -match '\.html$' -and $p -ne '/404.html') { Send $res 308 $null ([byte[]]@()) ($p -replace '\.html$','' -replace '/index$','/'); continue }
    $dest = $p
    foreach ($r in $cfg.rewrites) { if ($r.source -eq $p) { $dest = $r.destination } }
    if ($dest -eq '/') { $dest = '/index.html' }
    $fp = Join-Path $root $dest.TrimStart('/')
    if (-not (Test-Path $fp -PathType Leaf) -and (Test-Path ($fp + '.html') -PathType Leaf)) { $fp = $fp + '.html' }
    if ($p -match '^/(docs|scripts)(/|$)') { Send $res 307 $null ([byte[]]@()) '/'; continue }
    if (Test-Path $fp -PathType Leaf) {
      $ext = [IO.Path]::GetExtension($fp).ToLower(); $ct = $mime[$ext]; if (-not $ct) { $ct = 'application/octet-stream' }
      $res.Headers.Add('X-Content-Type-Options','nosniff'); Send $res 200 $ct ([IO.File]::ReadAllBytes($fp)) $null
    } else { Send $res 404 'text/html; charset=utf-8' ([IO.File]::ReadAllBytes((Join-Path $root '404.html'))) $null }
  } catch { } finally { try { $res.OutputStream.Close() } catch { } }
}
