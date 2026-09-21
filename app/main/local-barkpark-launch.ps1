$ErrorActionPreference = 'Stop'
# Values come through the environment; paths are never interpolated as shell code.
$env:Path = $env:BARKDOWN_TOOL_PATH + ';' + $env:Path
Set-Location -LiteralPath $env:BARKDOWN_API_DIR
& $env:BARKDOWN_MIX_PATH run --no-start --no-compile --no-deps-check --no-halt $env:BARKDOWN_BOOT_SCRIPT
exit $LASTEXITCODE
