$ErrorActionPreference = "Stop"
if (-not $IsWindows) { throw "Windows clean-room verification requires Windows." }
pnpm clean-room:windows
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
