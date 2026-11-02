using SJANotificationApp;
using Xunit;

namespace SJANotificationApp.Tests
{
    public class AppDialogsTests
    {
        [Fact]
        public void ConfirmMethod_Exists_WithExpectedSignature()
        {
            var m = typeof(AppDialogs).GetMethod("Confirm");
            Assert.NotNull(m);
            Assert.Equal(typeof(bool), m!.ReturnType);

            var p = m.GetParameters();
            Assert.Equal(6, p.Length);
            Assert.Equal("owner", p[0].Name);
            Assert.Equal("title", p[1].Name);
            Assert.Equal("body", p[2].Name);
            Assert.Equal("confirmLabel", p[3].Name);
            Assert.Equal("cancelLabel", p[4].Name);
            Assert.Equal("isDestructive", p[5].Name);
        }
    }
}
