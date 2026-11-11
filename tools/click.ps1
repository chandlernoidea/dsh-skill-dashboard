param(
  [Parameter(Mandatory = $true)][int]$X,
  [Parameter(Mandatory = $true)][int]$Y,
  [switch]$Double
)

Add-Type @'
using System;
using System.Runtime.InteropServices;
public class Win32Mouse {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, IntPtr dwExtraInfo);
}
'@

[Win32Mouse]::SetProcessDPIAware() | Out-Null
[Win32Mouse]::SetCursorPos($X, $Y) | Out-Null
Start-Sleep -Milliseconds 150

$times = 1
if ($Double) { $times = 2 }
for ($i = 0; $i -lt $times; $i++) {
  [Win32Mouse]::mouse_event(0x0002, 0, 0, 0, [IntPtr]::Zero)
  Start-Sleep -Milliseconds 40
  [Win32Mouse]::mouse_event(0x0004, 0, 0, 0, [IntPtr]::Zero)
  Start-Sleep -Milliseconds 80
}

Write-Output ("clicked {0},{1} x{2}" -f $X, $Y, $times)
