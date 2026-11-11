param(
  [int]$X = -1,
  [int]$Y = -1,
  [int]$Delta = -600,
  [int]$Repeat = 1
)

Add-Type @'
using System;
using System.Runtime.InteropServices;
public class Win32Wheel {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, IntPtr dwExtraInfo);
}
'@

[Win32Wheel]::SetProcessDPIAware() | Out-Null
if ($X -ge 0 -and $Y -ge 0) {
  [Win32Wheel]::SetCursorPos($X, $Y) | Out-Null
  Start-Sleep -Milliseconds 150
}

$data = [BitConverter]::ToUInt32([BitConverter]::GetBytes([int32]$Delta), 0)
for ($i = 0; $i -lt $Repeat; $i++) {
  [Win32Wheel]::mouse_event(0x0800, 0, 0, $data, [IntPtr]::Zero)
  Start-Sleep -Milliseconds 90
}

Write-Output ("wheel {0} x{1}" -f $Delta, $Repeat)
