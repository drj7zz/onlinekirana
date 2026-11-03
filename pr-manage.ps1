$ErrorActionPreference = 'Stop'
Set-Location "C:\Users\girid\OneDrive\Documents\Desktop\birgunj\onlinekirana"
"protocol=https`nhost=github.com`n" | Out-File -Encoding ascii "$env:TEMP\cred-in.txt"
$cred = Get-Content "$env:TEMP\cred-in.txt" | & "C:\Program Files\Git\mingw64\bin\git-credential-manager.exe" get 2>$null
$token = (($cred | Select-String '^password=').Line).Substring(9)
$h = @{Authorization = "token $token"; Accept = "application/vnd.github+json" }

# List every PR (open or closed) so we can see what exists
$prs = Invoke-RestMethod -Uri "https://api.github.com/repos/drj7zz/onlinekirana/pulls?state=all" -Headers $h
"ALL PRs:"
$prs | ForEach-Object { "#$($_.number) [$($_.state)] $($_.title) <- $($_.head.ref)" }

# Close any open PR that is NOT the one we want, then confirm
foreach ($pr in $prs) {
  if ($pr.head.ref -ne 'feat/ui-upgrade-and-cache-fix' -and $pr.state -eq 'open') {
    Invoke-RestMethod -Uri "https://api.github.com/repos/drj7zz/onlinekirana/pulls/$($pr.number)" -Method Patch -Headers $h -Body '{"state":"closed"}' -ContentType "application/json" | Out-Null
    "CLOSED #$($pr.number) ($($pr.head.ref))"
  }
}
"OPEN NOW:"
(Invoke-RestMethod -Uri "https://api.github.com/repos/drj7zz/onlinekirana/pulls?state=open" -Headers $h) | ForEach-Object { "#$($_.number) $($_.title)" }

# Check status of the latest commit on the PR branch
$sha = (Invoke-RestMethod -Uri "https://api.github.com/repos/drj7zz/onlinekirana/branches/feat/ui-upgrade-and-cache-fix" -Headers $h).commit.sha
"PR HEAD: $sha"
$runs = Invoke-RestMethod -Uri "https://api.github.com/repos/drj7zz/onlinekirana/actions/runs?head_sha=$sha" -Headers $h
$runs.workflow_runs | ForEach-Object { "$($_.name): $($_.status)/$($_.conclusion)" }
