[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
Write-Output "C098_NATIVE_READY"
$line = [Console]::ReadLine()
Write-Output ("C098_NATIVE_READ:" + $line)
Write-Output ("C098_NATIVE_SIZE:" + [Console]::WindowWidth + ":" + [Console]::WindowHeight)
exit 23
