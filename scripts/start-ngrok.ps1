param(
  [int]$Port = 5000
)

# Starts ngrok and prints the public URL for webhook configuration.
# Requires ngrok installed and available on PATH. On first run, run `ngrok authtoken <your-token>`.

Write-Host "Starting ngrok for port $Port..." -ForegroundColor Cyan

try {
  $process = Start-Process -FilePath ngrok -ArgumentList "http $Port" -PassThru -WindowStyle Hidden
  Start-Sleep -Seconds 2
  # Query the ngrok API to get tunnels
  $apiUrl = 'http://127.0.0.1:4040/api/tunnels'
  $retries = 0
  while ($retries -lt 10) {
    try {
      $resp = Invoke-RestMethod -Uri $apiUrl -Method Get -ErrorAction Stop
      break
    } catch {
      Start-Sleep -Seconds 1
      $retries++
    }
  }

  if (-not $resp) {
    Write-Error "ngrok API not responding. Is ngrok installed and running?"
    exit 1
  }

  $https = $resp.tunnels | Where-Object { $_.proto -eq 'https' } | Select-Object -First 1
  if ($https) {
    $url = $https.public_url
    Write-Host "ngrok started." -ForegroundColor Green
    Write-Host "Public URL: $url" -ForegroundColor Yellow
    Write-Host "Set your Razorpay webhook URL to: $url/api/payments/razorpay/webhook" -ForegroundColor Cyan
  } else {
    Write-Error "No https tunnel found. Tunnels: $($resp.tunnels | ConvertTo-Json)"
  }
} catch {
  Write-Error "Failed to start or query ngrok: $_"
}
