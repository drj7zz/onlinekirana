$ErrorActionPreference = 'Stop'
Set-Location "C:\Users\girid\OneDrive\Documents\Desktop\birgunj\onlinekirana"
$cred = Get-Content cred-input.txt | & "C:\Program Files\Git\mingw64\bin\git-credential-manager.exe" get 2>$null
$token = (($cred | Select-String '^password=').Line).Substring(9)
$headers = @{Authorization = "token $token"; Accept = "application/vnd.github+json" }

# 1. List all PRs on the repo (to find any older/duplicate ones to close)
$prs = Invoke-RestMethod -Uri "https://api.github.com/repos/drj7zz/onlinekirana/pulls?state=all" -Headers $headers
"ALL PRs:"
$prs | ForEach-Object { "#$($_.number) [$($_.state)] $($_.title) <- $($_.head.ref)" }

# 2. Close everything except #3
foreach ($pr in $prs) {
  if ($pr.number -ne 3 -and $pr.state -eq 'open') {
    Invoke-RestMethod -Uri "https://api.github.com/repos/drj7zz/onlinekirana/pulls/$($pr.number)" -Method Patch -Headers $headers -Body (@{ state = "closed" } | ConvertTo-Json) -ContentType "application/json" | Out-Null
    "CLOSED #$($pr.number)"
  }
}

# 3. Confirm final state
$open = Invoke-RestMethod -Uri "https://api.github.com/repos/drj7zz/onlinekirana/pulls?state=open" -Headers $headers
"OPEN PRs NOW:"
$open | ForEach-Object { "#$($_.number) $($_.title)" }
