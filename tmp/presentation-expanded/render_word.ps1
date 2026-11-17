$ErrorActionPreference = 'Stop'
$wordApp = $null
$guide = $null
try {
    $wordApp = New-Object -ComObject Word.Application
    $wordApp.Visible = $false
    $wordApp.DisplayAlerts = 0
    $guide = $wordApp.Documents.Open('C:\Users\User\Desktop\cookiehome\output\presentation-expanded\Cookie_Homes_Practice_Guide.docx', $false, $true)
    $guide.Repaginate()
    $guide.ExportAsFixedFormat('C:\Users\User\Desktop\cookiehome\tmp\presentation-expanded\guide.pdf', 17)
    Write-Output ('Rendered pages: ' + $guide.ComputeStatistics(2))
} finally {
    if ($null -ne $guide) { $guide.Close(0) }
    if ($null -ne $wordApp) { $wordApp.Quit() }
}
