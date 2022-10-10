$empid = Start-Process -WindowStyle minimized -FilePath "C:\Program Files (x86)\HeartMath\emWave\emwavepc.exe" -PassThru
Write-Output $empid.Id