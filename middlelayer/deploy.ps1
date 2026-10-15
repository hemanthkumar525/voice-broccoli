# Run Direct AWS CLI deployment script
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir
node deploy-cli.mjs

