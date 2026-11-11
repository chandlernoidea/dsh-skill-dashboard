param(
  [string]$Keys = '^r',
  [int]$ProcessId = 8124
)

Add-Type @'
using System;
using System.Runtime.InteropServices;
public class Win32Focus {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
}
'@

[Win32Focus]::SetProcessDPIAware() | Out-Null
$p = Get-Process -Id $ProcessId -ErrorAction Stop
[Win32Focus]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
Start-Sleep -Milliseconds 400

$shell = New-Object -ComObject WScript.Shell
$shell.SendKeys($Keys)
Write-Output ("sent {0}" -f $Keys)
