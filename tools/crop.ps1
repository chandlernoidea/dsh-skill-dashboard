param(
  [Parameter(Mandatory = $true)][string]$In,
  [Parameter(Mandatory = $true)][string]$Out,
  [int]$X = 0,
  [int]$Y = 0,
  [int]$W = 0,
  [int]$H = 0,
  [int]$Scale = 1
)

Add-Type -AssemblyName System.Drawing

$src = [System.Drawing.Image]::FromFile($In)
try {
  if ($W -le 0) { $W = $src.Width - $X }
  if ($H -le 0) { $H = $src.Height - $Y }
  $dstW = [int]($W * $Scale)
  $dstH = [int]($H * $Scale)
  $bmp = New-Object System.Drawing.Bitmap $dstW, $dstH
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
  $g.DrawImage($src, (New-Object System.Drawing.Rectangle 0, 0, $dstW, $dstH), (New-Object System.Drawing.Rectangle $X, $Y, $W, $H), [System.Drawing.GraphicsUnit]::Pixel)
  New-Item -ItemType Directory -Force -Path ([System.IO.Path]::GetDirectoryName($Out)) | Out-Null
  $bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
  Write-Output ("cropped {0} -> {1} ({2}x{3})" -f $In, $Out, $dstW, $dstH)
}
finally {
  $src.Dispose()
}
