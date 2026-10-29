# Локальный приёмник для генератора (только localhost:8090, пишет ТОЛЬКО в uk/ ru/ en/ репозитория). Не деплоится (.vercelignore: /scripts/).
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add('http://localhost:8090/'); $l.Start()
while ($l.IsListening) {
  $c = $l.GetContext(); $rq = $c.Request; $rs = $c.Response
  $rs.AddHeader('Access-Control-Allow-Origin','*'); $rs.AddHeader('Access-Control-Allow-Headers','*'); $rs.AddHeader('Access-Control-Allow-Methods','POST,OPTIONS')
  $msg = 'ok'
  try {
    if ($rq.HttpMethod -eq 'POST') {
      $rel = $rq.QueryString['path']
      if ($rel -notmatch '^((uk|ru|en)/[a-z0-9-]+|scripts/i18n/review/[a-z0-9-]+).html$') { throw "bad path $rel" }
      $sr = New-Object System.IO.StreamReader($rq.InputStream, [Text.Encoding]::UTF8); $body = $sr.ReadToEnd()
      $dir = Split-Path (Join-Path $root $rel) -Parent; if (-not (Test-Path $dir)) { New-Item -ItemType Directory $dir | Out-Null }
      [IO.File]::WriteAllText((Join-Path $root $rel), $body, (New-Object Text.UTF8Encoding($false)))
      $msg = "saved $rel $($body.Length)"
    }
  } catch { $rs.StatusCode = 500; $msg = "ERR $_" }
  $b = [Text.Encoding]::UTF8.GetBytes($msg); $rs.OutputStream.Write($b,0,$b.Length); $rs.Close()
}
