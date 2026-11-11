param(
  [Parameter(Mandatory = $true)][int]$ProcessId,
  [string]$Out = ""
)
if (-not $Out) { $Out = Join-Path $PSScriptRoot "..\.shots\app.png" }

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class Win32Shot {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
}
'@

[Win32Shot]::SetProcessDPIAware() | Out-Null

$p = Get-Process -Id $ProcessId -ErrorAction Stop
$h = $p.MainWindowHandle
if ($h -eq [IntPtr]::Zero) { throw "no window handle for pid $ProcessId" }

if ([Win32Shot]::IsIconic($h)) {
  [Win32Shot]::ShowWindow($h, 9) | Out-Null
  Start-Sleep -Milliseconds 350
}
[Win32Shot]::SetForegroundWindow($h) | Out-Null
Start-Sleep -Milliseconds 350

$r = [Win32Shot+RECT]::new()
[Win32Shot]::GetWindowRect($h, [ref]$r) | Out-Null
$w = $r.Right - $r.Left
$hh = $r.Bottom - $r.Top

$bmp = New-Object System.Drawing.Bitmap $w, $hh
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($r.Left, $r.Top, 0, 0, (New-Object System.Drawing.Size $w, $hh))
New-Item -ItemType Directory -Force -Path ([System.IO.Path]::GetDirectoryName($Out)) | Out-Null
$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()

Write-Output ("saved {0} | {1}x{2} | origin {3},{4}" -f $Out, $w, $hh, $r.Left, $r.Top)
