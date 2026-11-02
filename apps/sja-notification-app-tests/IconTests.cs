using System.Drawing;
using SJANotificationApp;
using Xunit;

namespace SJANotificationApp.Tests
{
    public class IconTests
    {
        [Theory]
        [InlineData("home")]
        [InlineData("history")]
        [InlineData("settings")]
        [InlineData("remote")]
        [InlineData("idesk")]
        [InlineData("close")]
        [InlineData("minimize")]
        [InlineData("maximize")]
        [InlineData("restore")]
        [InlineData("chevron-down")]
        [InlineData("chevron-right")]
        [InlineData("external")]
        [InlineData("search")]
        [InlineData("refresh")]
        [InlineData("warning")]
        [InlineData("check")]
        [InlineData("trash")]
        [InlineData("exit")]
        public void GetMenuIcon_DrawsSomething(string key)
        {
            using var bmp = FluentTheme.GetMenuIcon(key, Color.Black, 16);

            Assert.Equal(16, bmp.Width);
            Assert.Equal(16, bmp.Height);

            bool anyPixelDrawn = false;
            for (int x = 0; x < bmp.Width && !anyPixelDrawn; x++)
                for (int y = 0; y < bmp.Height && !anyPixelDrawn; y++)
                    if (bmp.GetPixel(x, y).A > 0) anyPixelDrawn = true;

            Assert.True(anyPixelDrawn, $"Ikon '{key}' tidak menggambar apa pun");
        }

        [Fact]
        public void GetMenuIcon_RespectsRequestedSize()
        {
            using var bmp = FluentTheme.GetMenuIcon("home", Color.Black, 24);
            Assert.Equal(24, bmp.Width);
            Assert.Equal(24, bmp.Height);
        }

        [Fact]
        public void ExitIcon_UsesTintNotHardcodedRed()
        {
            using var bmp = FluentTheme.GetMenuIcon("exit", Color.Blue, 16);

            bool foundTailwindRed = false;
            for (int x = 0; x < bmp.Width; x++)
                for (int y = 0; y < bmp.Height; y++)
                {
                    var p = bmp.GetPixel(x, y);
                    if (p.A > 200 && p.R > 220 && p.G < 90 && p.B < 90) foundTailwindRed = true;
                }

            Assert.False(foundTailwindRed, "Ikon exit masih mengunci merah literal");
        }
    }
}
