$ErrorActionPreference = 'Stop'
Set-Location "C:\Users\girid\OneDrive\Documents\Desktop\birgunj\onlinekirana"
"protocol=https`nhost=github.com`n" | Out-File -Encoding ascii "$env:TEMP\cred-in.txt"
$cred = Get-Content "$env:TEMP\cred-in.txt" | & "C:\Program Files\Git\mingw64\bin\git-credential-manager.exe" get 2>$null
$token = (($cred | Select-String '^password=').Line).Substring(9)
$h = @{Authorization = "token $token"; Accept = "application/vnd.github+json" }

"=== Who am I on GitHub? ==="
$me = Invoke-RestMethod -Uri "https://api.github.com/user" -Headers $h
"$($me.login) / $($me.email)"

"=== Commit author/verified status on PR head ==="
$sha = (Invoke-RestMethod -Uri "https://api.github.com/repos/drj7zz/onlinekirana/branches/feat/ui-upgrade-and-cache-fix" -Headers $h).commit.sha
$c = Invoke-RestMethod -Uri "https://api.github.com/repos/drj7zz/onlinekirana/commits/$sha" -Headers $h
"SHA: $($c.sha.Substring(0,8))"
"Author name : $($c.commit.author.name)"
"Author email: $($c.commit.author.email)"
"GitHub-linked: $(if ($c.author) { $c.author.login } else { 'NOT LINKED' })"
"Verification: $($c.commit.verification.reason) / verified=$($c.commit.verification.verified)"

"=== Fix: rewrite last commit with drj7zz's real GitHub email, then force-push ==="
git config user.name "drj7zz"
git config user.email "giridirghraj@gmail.com"
git commit --amend --no-edit --reset-author
git push --force-with-lease origin feat/ui-upgrade-and-cache-fix
"REPUSHED"

"=== My verified emails on GitHub ==="
(Invoke-RestMethod -Uri "https://api.github.com/user/emails" -Headers $h) | ForEach-Object { "$($_.email) verified=$($_.verified) primary=$($_.primary)" }

"=== CI runs on head ==="
(Invoke-RestMethod -Uri "https://api.github.com/repos/drj7zz/onlinekirana/actions/runs?head_sha=$sha" -Headers $h).workflow_runs | ForEach-Object { "$($_.name): $($_.status)/$($_.conclusion)" }
