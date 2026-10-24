param(
    [Parameter(Mandatory=$true)][string]$PostgresBin,
    [Parameter(Mandatory=$true)][string]$GradlePath,
    [Parameter(Mandatory=$true)][string]$JavaHome,
    [string]$Distribution = 'Ubuntu'
)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskOutput = Join-Path $taskRoot ('output/runtime-' + [guid]::NewGuid().ToString('N'))
$taskLinuxRoot = (& wsl -d $Distribution -- wslpath -a $taskRoot.Replace('\','/'))
if ($LASTEXITCODE -ne 0) { throw 'Cannot resolve WSL project path' }
$taskLinuxRoot = $taskLinuxRoot.Trim()
$taskLinuxOutput = $taskLinuxRoot + '/output/' + (Split-Path -Leaf $taskOutput)
$taskServiceScript = $taskLinuxRoot + '/validation/runtime/services.py'
$taskVariables = @('JAVA_HOME','COMMERCE_TEST_OUTPUT','COMMERCE_TEST_DB','COMMERCE_TEST_REDIS_PORT','COMMERCE_TEST_PASSWORD')
$taskPrevious = @{}
foreach ($taskVariable in $taskVariables) { $taskPrevious[$taskVariable] = [Environment]::GetEnvironmentVariable($taskVariable, 'Process') }
try {
    & wsl -d $Distribution -- python3 $taskServiceScript start $taskLinuxOutput $PostgresBin
    if ($LASTEXITCODE -ne 0) { throw 'Isolated service startup failed' }
    $taskConfig = Get-Content -LiteralPath (Join-Path $taskOutput services.json) -Raw | ConvertFrom-Json
    $env:JAVA_HOME = $JavaHome
    $env:COMMERCE_TEST_OUTPUT = $taskOutput
    $env:COMMERCE_TEST_DB = 'jdbc:postgresql://127.0.0.1:' + $taskConfig.postgresPort + '/commerce_validation'
    $env:COMMERCE_TEST_REDIS_PORT = [string]$taskConfig.redisPort
    $env:COMMERCE_TEST_PASSWORD = $taskConfig.password
    & $GradlePath --no-daemon --console=plain --project-dir (Join-Path $taskRoot validation/runtime) --project-cache-dir (Join-Path $taskOutput gradle-project) --gradle-user-home (Join-Path $taskRoot output/runtime-gradle) test
    if ($LASTEXITCODE -ne 0) { throw ('Runtime checks failed. Evidence: ' + $taskOutput) }
    Write-Output ('Runtime checks passed. Evidence: ' + $taskOutput)
} finally {
    try {
        if (Test-Path -LiteralPath (Join-Path $taskOutput services.json)) {
            & wsl -d $Distribution -- python3 $taskServiceScript stop $taskLinuxOutput
            if ($LASTEXITCODE -ne 0) { throw ('Service cleanup failed: ' + $taskOutput) }
        }
    } finally {
        foreach ($taskVariable in $taskVariables) {
            if ($null -eq $taskPrevious[$taskVariable]) {
                Remove-Item -LiteralPath ('Env:' + $taskVariable) -ErrorAction SilentlyContinue
            } else {
                [Environment]::SetEnvironmentVariable($taskVariable, $taskPrevious[$taskVariable], 'Process')
            }
        }
    }
}
