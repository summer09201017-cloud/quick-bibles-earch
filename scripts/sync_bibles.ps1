param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Only
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root

$python = Get-Command python -ErrorAction Stop
$arguments = @("scripts/sync_bibles.py")

if ($Only.Count -gt 0) {
    $arguments += "--only"
    $arguments += $Only
}

& $python.Source @arguments
exit $LASTEXITCODE
