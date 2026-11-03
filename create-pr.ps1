$ErrorActionPreference = 'Stop'
Set-Location "C:\Users\girid\OneDrive\Documents\Desktop\birgunj\onlinekirana"
$cred = Get-Content cred-input.txt | & "C:\Program Files\Git\mingw64\bin\git-credential-manager.exe" get 2>$null
$token = (($cred | Select-String '^password=').Line).Substring(9)
$body = [System.IO.File]::ReadAllText("$PWD\pr-body.md")
$payload = @{
  title = "UI upgrade: skeletons, toasts, mobile navigation, image fixes + cached-products payload fix"
  head  = "feat/ui-upgrade-and-cache-fix"
  base  = "main"
  body  = $body
} | ConvertTo-Json
$r = Invoke-RestMethod -Uri "https://api.github.com/repos/drj7zz/onlinekirana/pulls" -Method Post -Headers @{Authorization = "token $token"; Accept = "application/vnd.github+json" } -Body ([System.Text.Encoding]::UTF8.GetBytes($payload)) -ContentType "application/json"
"PR CREATED: #$($r.number)"
$r.html_url
