$ErrorActionPreference = 'Stop'
Set-Location "C:\Users\girid\OneDrive\Documents\Desktop\birgunj\onlinekirana"
"protocol=https`nhost=github.com`n" | Out-File -Encoding ascii cred-input.txt
$cred = Get-Content cred-input.txt | & "C:\Program Files\Git\mingw64\bin\git-credential-manager.exe" get 2>$null
$token = (($cred | Select-String '^password=').Line).Substring(9)
$headers = @{Authorization = "token $token"; Accept = "application/vnd.github+json" }

# Which check runs failed on PR #3's head commit?
$sha = git rev-parse HEAD
"HEAD: $sha"
$checks = Invoke-RestMethod -Uri "https://api.github.com/repos/drj7zz/onlinekirana/commits/$sha/check-runs" -Headers $headers
$checks.check_runs | ForEach-Object { "$($_.name) [$($_.status)/$(if($_.conclusion){$_.conclusion}else{'pending'})]"
  if ($_.conclusion -eq 'failure') { "  URL: $($_.html_url)"; "  Output: $($_.output.title)" }
}
