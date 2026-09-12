using System.Drawing;
using SJANotificationApp;
using Xunit;

namespace SJANotificationApp.Tests
{
    public class ThemeTokenTests
    {
        [Fact]
        public void LightTheme_UsesApplePalette()
        {
            FluentTheme.SetThemeOverride(false);

            Assert.Equal(Color.FromArgb(245, 245, 247), FluentTheme.ThemeCanvasTop);
            Assert.Equal(Color.FromArgb(29, 29, 31), FluentTheme.ThemeTextPrimary);
            Assert.Equal(Color.FromArgb(0, 113, 227), FluentTheme.ThemeAccent);

            FluentTheme.SetThemeOverride(null);
        }

        [Fact]
        public void DarkTheme_UsesApplePalette()
        {
            FluentTheme.SetThemeOverride(true);

            Assert.Equal(Color.FromArgb(28, 28, 30), FluentTheme.ThemeCanvasTop);
            Assert.Equal(Color.FromArgb(245, 245, 247), FluentTheme.ThemeTextPrimary);
            Assert.Equal(Color.FromArgb(10, 132, 255), FluentTheme.ThemeAccent);

            FluentTheme.SetThemeOverride(null);
        }

        [Fact]
        public void StatusTokens_AreThemeAware()
        {
            FluentTheme.SetThemeOverride(false);
            var lightOnline = FluentTheme.ThemeStatusOnline;
            var lightCritical = FluentTheme.ThemeStatusCritical;

            FluentTheme.SetThemeOverride(true);
            var darkOnline = FluentTheme.ThemeStatusOnline;
            var darkCritical = FluentTheme.ThemeStatusCritical;

            FluentTheme.SetThemeOverride(null);

            Assert.Equal(Color.FromArgb(36, 138, 61), lightOnline);
            Assert.Equal(Color.FromArgb(48, 209, 88), darkOnline);
            Assert.Equal(Color.FromArgb(201, 37, 45), lightCritical);
            Assert.Equal(Color.FromArgb(255, 105, 97), darkCritical);
        }

        [Theory]
        [InlineData("critical", "Blocker")]
        [InlineData("blocker", "Blocker")]
        [InlineData("high", "Urgent")]
        [InlineData("urgent", "Urgent")]
        [InlineData("low", "Low")]
        [InlineData("medium", "Normal")]
        [InlineData("normal", "Normal")]
        [InlineData(null, "INFO")]
        public void GetPriorityDisplayLabel_IsUnchanged(string? input, string expected)
        {
            Assert.Equal(expected, FluentTheme.GetPriorityDisplayLabel(input));
        }

        [Fact]
        public void GetPriorityTheme_UsesStatusTokensNotTailwind()
        {
            FluentTheme.SetThemeOverride(false);
            var urgent = FluentTheme.GetPriorityTheme("critical");
            FluentTheme.SetThemeOverride(null);

            // Tailwind red-600 (220,38,38) tidak boleh muncul lagi
            Assert.NotEqual(Color.FromArgb(220, 38, 38), urgent.Text);
            Assert.Equal(Color.FromArgb(201, 37, 45), urgent.Text);
        }

        [Fact]
        public void FontFamily_NeverResolvesToApplePlatformFonts()
        {
            using var font = FluentTheme.GetFont(9F);
            Assert.DoesNotContain("SF Pro", font.Name);
        }

        [Fact]
        public void FontFamily_IsAWindowsSystemFace()
        {
            using var font = FluentTheme.GetFont(9F);
            Assert.True(
                font.Name.StartsWith("Segoe UI") || font.Name == "Arial",
                $"Font tak terduga: {font.Name}");
        }
    }
}
