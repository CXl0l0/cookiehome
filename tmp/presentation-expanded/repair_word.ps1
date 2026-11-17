$ErrorActionPreference = 'Stop'
$wordApp = New-Object -ComObject Word.Application
$wordApp.Visible = $false
$wordApp.DisplayAlerts = 0
$guide = $null
$miss = [Type]::Missing
try {
    $guide = $wordApp.Documents.Open('C:\Users\User\Desktop\cookiehome\output\presentation-expanded\Cookie_Homes_Practice_Guide.docx', $false, $false, $false, $miss, $miss, $miss, $miss, $miss, $miss, $miss, $false, $true)
    $guide.SaveAs2('C:\Users\User\Desktop\cookiehome\tmp\presentation-expanded\repaired.docx', 16)
    $guide.ExportAsFixedFormat('C:\Users\User\Desktop\cookiehome\tmp\presentation-expanded\guide.pdf', 17)
    Write-Output ('Rendered pages: ' + $guide.ComputeStatistics(2))
} finally {
    if ($null -ne $guide) { $guide.Close(0) }
    $wordApp.Quit()
}
