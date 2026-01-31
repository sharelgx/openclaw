# 在服务器上拉取 n8n 仓库
# 用法: .\clone-n8n.ps1  或  powershell -ExecutionPolicy Bypass -File .\clone-n8n.ps1

$targetDir = "e:\AIcode\moltbot"
$repoDir = Join-Path $targetDir "n8n"

Set-Location $targetDir

# 若已有不完整克隆，先删除
if (Test-Path $repoDir) {
    Write-Host "正在删除已有目录 $repoDir ..."
    Remove-Item -Recurse -Force $repoDir -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

Write-Host "正在克隆 n8n（浅克隆，仅最新提交）..."
git clone --depth 1 https://github.com/n8n-io/n8n.git $repoDir

if ($LASTEXITCODE -eq 0) {
    Write-Host "克隆完成。目录: $repoDir"
    Set-Location $repoDir
    git status
} else {
    Write-Host "克隆失败，请检查网络或手动执行: git clone --depth 1 https://github.com/n8n-io/n8n.git"
}
