Add-Type -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;

public static class IconGen
{
    public static Bitmap Draw(int size)
    {
        var bmp = new Bitmap(size, size, PixelFormat.Format32bppArgb);
        using (var g = Graphics.FromImage(bmp))
        {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.AntiAlias;
            g.Clear(Color.Transparent);
            float s = size / 512f;

            // 圆角背景
            var rect = new RectangleF(0, 0, size, size);
            using (var bg = new LinearGradientBrush(rect, Color.FromArgb(255, 139, 92, 246), Color.FromArgb(255, 217, 70, 239), 45f))
            {
                g.FillPath(bg, RoundRect(rect, 96 * s));
            }

            // 白色日历卡片
            var cardW = 330 * s; var cardH = 250 * s;
            var cardX = (512 - 330) / 2f * s; var cardY = 108 * s;
            var card = new RectangleF(cardX, cardY, cardW, cardH);
            using (var white = new SolidBrush(Color.White))
            {
                g.FillPath(white, RoundRect(card, 44 * s));
            }

            // 顶部渐变条
            var bar = new RectangleF(cardX + 8 * s, cardY + 8 * s, cardW - 16 * s, 64 * s);
            using (var barBrush = new LinearGradientBrush(bar, Color.FromArgb(255, 139, 92, 246), Color.FromArgb(255, 217, 70, 239), 0f))
            {
                g.FillPath(barBrush, RoundRect(bar, 36 * s));
            }

            // 提手圆环
            using (var ring = new SolidBrush(Color.White))
            {
                g.FillEllipse(ring, cardX + 76 * s, cardY - 26 * s, 44 * s, 44 * s);
                g.FillEllipse(ring, cardX + cardW - 120 * s, cardY - 26 * s, 44 * s, 44 * s);
            }

            // 对勾
            using (var pen = new Pen(Color.FromArgb(255, 139, 92, 246), Math.Max(4f, 58 * s)))
            {
                pen.StartCap = LineCap.Round; pen.EndCap = LineCap.Round; pen.LineJoin = LineJoin.Round;
                var midY = cardY + cardH / 2f;
                var pts = new PointF[]
                {
                    new PointF(cardX + 70 * s, midY + 4 * s),
                    new PointF(cardX + 140 * s, midY + 66 * s),
                    new PointF(cardX + cardW - 60 * s, midY - 62 * s)
                };
                g.DrawLines(pen, pts);
            }
        }
        return bmp;
    }

    private static GraphicsPath RoundRect(RectangleF r, float radius)
    {
        var path = new GraphicsPath();
        float d = radius * 2;
        path.AddArc(r.X, r.Y, d, d, 180, 90);
        path.AddArc(r.Right - d, r.Y, d, d, 270, 90);
        path.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
        path.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
        path.CloseFigure();
        return path;
    }

    public static void SaveIco(Bitmap src, string path)
    {
        using (var ms = new MemoryStream())
        {
            src.Save(ms, ImageFormat.Png);
            var png = ms.ToArray();
            using (var fs = File.Create(path))
            using (var w = new BinaryWriter(fs))
            {
                w.Write((ushort)0); w.Write((ushort)1); w.Write((ushort)1);
                w.Write((byte)0); w.Write((byte)0); w.Write((byte)0); w.Write((byte)0);
                w.Write((ushort)1); w.Write((ushort)32);
                w.Write((uint)png.Length); w.Write((uint)22);
                w.Write(png);
            }
        }
    }
}
"@

$outDir = Join-Path $PSScriptRoot "..\src-tauri\icons"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$master = [IconGen]::Draw(512)
$master.Save((Join-Path $outDir "icon.png"), [System.Drawing.Imaging.ImageFormat]::Png)

foreach ($size in @(256, 128, 32)) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($master, 0, 0, $size, $size)
    $g.Dispose()
    $name = if ($size -eq 256) { "128x128@2x.png" } elseif ($size -eq 128) { "128x128.png" } else { "32x32.png" }
    $bmp.Save((Join-Path $outDir $name), [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output "generated $name"
}
[IconGen]::SaveIco($master, (Join-Path $outDir "icon.ico"))
$master.Dispose()
Write-Output "generated icon.ico"
