[CmdletBinding()]
param(
    [switch]$Broadcast,
    [ValidatePattern('^[A-Za-z0-9_-]+$')]
    [string]$Account = 'avaclash-deployer'
)

$ErrorActionPreference = 'Stop'
$repoDirectory = Split-Path -Parent $PSScriptRoot
$configPath = Join-Path $repoDirectory '.env.fuji.local'
if (-not (Test-Path -LiteralPath $configPath)) {
    throw 'Missing .env.fuji.local in the repository root.'
}
foreach ($commandName in @('node', 'forge', 'cast')) {
    $null = Get-Command $commandName -ErrorAction Stop
}

# Load only public deployment settings, never a key/password or shell expression.
$publicNames = @(
    'FUJI_RPC_URL', 'DEPLOYER_ADDRESS', 'RELAY_SIGNER_ADDRESS',
    'ARBITER_ADDRESS', 'TREASURY_ADDRESS'
)
$publicConfig = @{}
foreach ($line in Get-Content -LiteralPath $configPath) {
    if ($line -match '^([A-Z_]+)=(.*)$' -and $publicNames -contains $Matches[1]) {
        $name = $Matches[1]
        $value = $Matches[2].Trim()
        if ($publicConfig.ContainsKey($name)) { throw "Duplicate setting: $name" }
        $publicConfig[$name] = $value
    }
}
foreach ($name in $publicNames) {
    if (-not $publicConfig[$name]) { throw "Missing public configuration: $name" }
    Set-Item -LiteralPath "Env:$name" -Value $publicConfig[$name]
}

$broadcastPath = Join-Path $repoDirectory 'contracts/broadcast/Deploy.s.sol/43113/run-latest.json'
if ($Broadcast -and (Test-Path -LiteralPath $broadcastPath)) {
    throw 'A Fuji broadcast record already exists. Review its receipts before retrying to avoid deploying twice.'
}

Push-Location -LiteralPath $repoDirectory
try {
    Write-Host 'Checking Fuji RPC, account addresses and gas balances...'
    & node 'scripts/fuji-preflight.mjs' $configPath
    if ($LASTEXITCODE -ne 0) { throw 'Fuji preflight failed. No transactions sent.' }

    if ($Broadcast) {
        Write-Host "Unlock '$Account' to verify the signer. Enter your keystore password in the terminal."
        # Cast reads the password itself; this script captures only the public address.
        $actualDeployer = (& cast wallet address --account $Account | Out-String).Trim()
        if ($LASTEXITCODE -ne 0) { throw 'Could not unlock the deployer keystore. No transactions sent.' }
        if ($actualDeployer -ine $publicConfig['DEPLOYER_ADDRESS']) {
            throw "Keystore address does not match DEPLOYER_ADDRESS. No transactions sent. Public address: $actualDeployer"
        }
        Write-Host "Verified deployer: $actualDeployer"
    }

    Set-Location -LiteralPath (Join-Path $repoDirectory 'contracts')
    $forgeArguments = @(
        'script', 'script/Deploy.s.sol:DeployScript',
        '--rpc-url', $publicConfig['FUJI_RPC_URL'], '--chain', '43113',
        '--sender', $publicConfig['DEPLOYER_ADDRESS']
    )
    if ($Broadcast) {
        Write-Host 'Deploying to Fuji (43113). Enter the keystore password again if Forge prompts.'
        $forgeArguments += @('--account', $Account, '--broadcast', '--slow')
    } else {
        Write-Host 'Simulation only. No private key is needed and no transactions will be sent.'
        $forgeArguments += '--non-interactive'
    }
    & forge @forgeArguments
    if ($LASTEXITCODE -ne 0) {
        throw 'Forge did not complete successfully. If broadcasting started, review the receipts before retrying.'
    }
    if ($Broadcast) {
        Write-Host 'Forge broadcast completed. Verify the on-chain receipts before configuring the web and relay.'
        Write-Host "Receipt file: $broadcastPath"
    } else {
        Write-Host 'Fuji simulation completed. Add -Broadcast when you are ready to sign and deploy.'
    }
} finally {
    Pop-Location
}
