Write-Host "Exporting COMPLETE Eterna Codebase..." -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

# --- Configuration ---
$outputDir = "docs\context"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$outputFile = "$outputDir\dex_engine_FULL_$timestamp.md"

# Ensure output directory exists
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

# --- 1. Helper Functions ---

function Get-SyntaxLanguage {
    param([string]$Extension)
    switch ($Extension) {
        { $_ -in @('.ts', '.tsx') } { 'typescript' }
        { $_ -in @('.js', '.jsx', '.cjs', '.mjs') } { 'javascript' }
        '.json' { 'json' }
        { $_ -in @('.yaml', '.yml') } { 'yaml' }
        '.sql' { 'sql' }
        '.prisma' { 'prisma' }
        '.md' { 'markdown' }
        { $_ -in @('.env', '.example') } { 'bash' }
        default { 'text' }
    }
}

function Add-FileContent {
    param([string]$Path)
    
    if (-not (Test-Path $Path)) { return }

    # Get relative path
    $relativePath = $Path.Replace((Get-Location).Path + '\', '').Replace('\', '/')
    $ext = [System.IO.Path]::GetExtension($Path)
    $lang = Get-SyntaxLanguage -Extension $ext

    # Skip if it's the output file itself
    if ($Path -like "*$outputFile*") { return }

    "### ``$relativePath``" | Out-File -FilePath $outputFile -Append -Encoding UTF8
    "" | Out-File -FilePath $outputFile -Append -Encoding UTF8
    "``````$lang" | Out-File -FilePath $outputFile -Append -Encoding UTF8

    try {
        if ((Get-Item $Path).Length -gt 500KB) {
            "// Large file - showing first 200 lines" | Out-File -FilePath $outputFile -Append -Encoding UTF8
            Get-Content $Path -First 200 | Out-File -FilePath $outputFile -Append -Encoding UTF8
            "// ..." | Out-File -FilePath $outputFile -Append -Encoding UTF8
        } else {
            Get-Content $Path -Raw | Out-File -FilePath $outputFile -Append -Encoding UTF8
        }
    } catch {
        "// Error reading file" | Out-File -FilePath $outputFile -Append -Encoding UTF8
    }

    "``````" | Out-File -FilePath $outputFile -Append -Encoding UTF8
    "" | Out-File -FilePath $outputFile -Append -Encoding UTF8
    
    Write-Host "  + $relativePath" -ForegroundColor DarkGray
}

function Scan-Directory {
    param([string]$Path, [string]$Title)

    if (-not (Test-Path $Path)) { 
        Write-Host "  ! Skipped $Title (Path not found: $Path)" -ForegroundColor Red
        return 
    }

    Write-Host "`nScanning $Title..." -ForegroundColor Yellow
    "## $Title" | Out-File -FilePath $outputFile -Append -Encoding UTF8
    "" | Out-File -FilePath $outputFile -Append -Encoding UTF8

    # Get ALL files, then filter out trash
    $files = Get-ChildItem -Path $Path -Recurse -File | 
        Where-Object { 
            ($_.FullName -notmatch "node_modules") -and 
            ($_.FullName -notmatch "dist") -and 
            ($_.FullName -notmatch ".turbo") -and
            ($_.FullName -notmatch ".git") -and
            ($_.FullName -notmatch "coverage") -and
            ($_.Extension -match "\.(ts|tsx|js|jsx|json|prisma|sql|yaml|yml|md|env|example)$")
        }

    foreach ($file in $files) {
        Add-FileContent -Path $file.FullName
    }
}

# --- 2. Initialize Output File ---
@"
# Eterna DEX Engine: Full Codebase

**Generated:** $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

---

"@ | Out-File -FilePath $outputFile -Encoding UTF8

# --- 3. Execute Scans ---

# Root Configs
Write-Host "Scanning Root Configs..." -ForegroundColor Yellow
"## Root Configuration" | Out-File -FilePath $outputFile -Append -Encoding UTF8
"" | Out-File -FilePath $outputFile -Append -Encoding UTF8
$rootFiles = @("package.json", "turbo.json", "tsconfig.json", "docker-compose.yml", "README.md", ".gitignore", ".env.example", ".env")
foreach ($f in $rootFiles) {
    if (Test-Path $f) { Add-FileContent -Path (Get-Item $f).FullName }
}

# Apps
Scan-Directory -Path "apps\api" -Title "App: API"
Scan-Directory -Path "apps\worker" -Title "App: Worker"

# Packages
Scan-Directory -Path "packages\database" -Title "Package: Database"
Scan-Directory -Path "packages\mock-router" -Title "Package: Mock Router"
Scan-Directory -Path "packages\types" -Title "Package: Types"
Scan-Directory -Path "packages\eslint-config" -Title "Package: ESLint Config"
Scan-Directory -Path "packages\typescript-config" -Title "Package: TS Config"

# --- Summary ---
$fileSize = (Get-Item $outputFile).Length
$sizeMB = [math]::Round($fileSize / 1MB, 2)

Write-Host "`n================================================" -ForegroundColor Green
Write-Host "EXPORT COMPLETE!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host "Output: $outputFile" -ForegroundColor Cyan
Write-Host "Size:   $sizeMB MB" -ForegroundColor Cyan
Write-Host "================================================`n" -ForegroundColor Green