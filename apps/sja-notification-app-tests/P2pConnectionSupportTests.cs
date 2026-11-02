using System.IO;
using SJANotificationApp;
using Xunit;

namespace SJANotificationApp.Tests;

public class P2pConnectionSupportTests
{
    [Fact]
    public void ResolveLocalP2pIp_SelectsTheLanInterfaceUsedToReachTheServer()
    {
        var selected = P2pConnectionSupport.ResolveLocalP2pIp(
            "10.10.6.13",
            new[] { "172.28.144.1", "10.10.6.51", "127.0.0.1" });

        Assert.Equal("10.10.6.51", selected);
    }

    [Fact]
    public void ResolveLocalP2pIp_ReturnsNullWhenNoPrivateUnicastAddressExists()
    {
        var selected = P2pConnectionSupport.ResolveLocalP2pIp(
            "10.10.6.13",
            new[] { "127.0.0.1", "169.254.10.2", "8.8.8.8" });

        Assert.Null(selected);
    }

    [Fact]
    public async Task RunWithTimeoutAsync_ThrowsTimeoutWhenAuthenticationStalls()
    {
        await Assert.ThrowsAsync<TimeoutException>(() =>
            P2pConnectionSupport.RunWithTimeoutAsync(
                async cancellationToken =>
                {
                    await Task.Delay(Timeout.InfiniteTimeSpan, cancellationToken);
                    return true;
                },
                TimeSpan.FromMilliseconds(25),
                CancellationToken.None));
    }

    [Theory]
    [InlineData(typeof(TimeoutException), true)]
    [InlineData(typeof(IOException), true)]
    [InlineData(typeof(UnauthorizedAccessException), true)]
    [InlineData(typeof(InvalidOperationException), false)]
    public void ShouldFallback_ClassifiesDirectTransportFailures(Type exceptionType, bool expected)
    {
        var exception = (Exception)Activator.CreateInstance(exceptionType)!;

        Assert.Equal(expected, P2pConnectionSupport.ShouldFallback(exception));
    }

    [Theory]
    [InlineData("10.10.6.51", true)]
    [InlineData("192.168.1.100", true)]
    [InlineData("172.20.10.2", true)]
    [InlineData("172.19.0.1", false)] // Docker container bridge gateway
    [InlineData("127.0.0.1", false)] // loopback
    [InlineData("8.8.8.8", false)] // public WAN
    [InlineData("", false)]
    [InlineData(null, false)]
    public void IsUsableDirectLanIp_IdentifiesRoutablePrivateEndpoints(string? ipAddress, bool expected)
    {
        Assert.Equal(expected, P2pConnectionSupport.IsUsableDirectLanIp(ipAddress));
    }

    [Fact]
    public async Task RemoteHostEngine_CaptureLoopTest()
    {
        using var host = new RemoteHostEngine(0);
        host.Start();
        host.AuthorizeSession("test-s", "test-sec", "agent-1", "127.0.0.1", DateTime.UtcNow.AddMinutes(5), 10);
        host.GrantConsent();
        byte[]? receivedPacket = null;
        host.OnRelayFrameReady += packet => receivedPacket = packet;
        host.EnableRelayCapture();
        await Task.Delay(1000);
        Assert.NotNull(receivedPacket);
    }

    [Fact]
    public async Task RemoteHostEngine_P2PHandshakeAndTileStreamTest()
    {
        using var host = new RemoteHostEngine(0);
        host.Start();
        int testPort = host.BoundPort;
        host.AuthorizeSession("test-p2p", "secret-123", "agent-x", "127.0.0.1", DateTime.UtcNow.AddMinutes(5), 10);
        host.GrantConsent();

        using var client = new System.Net.Sockets.TcpClient();
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        await client.ConnectAsync("127.0.0.1", testPort, cts.Token);
        var stream = client.GetStream();

        // 1. Handshake
        await RemoteHostEngine.WriteCommandAsync(stream, new
        {
            t = "auth",
            sessionId = "test-p2p",
            secret = "secret-123"
        }, cts.Token);

        var authDoc = await RemoteHostEngine.ReadCommandAsync(stream, cts.Token);
        Assert.NotNull(authDoc);
        Assert.Equal("auth_ok", authDoc.RootElement.GetProperty("t").GetString());

        // 2. Receive first tile frame magic
        byte[] magicBytes = new byte[4];
        int mRead = 0;
        while (mRead < 4)
        {
            int r = await stream.ReadAsync(magicBytes.AsMemory(mRead, 4 - mRead), cts.Token);
            if (r == 0) break;
            mRead += r;
        }
        Assert.Equal(4, mRead);
        uint magic = BitConverter.ToUInt32(magicBytes, 0);
        Assert.Equal(RemoteHostEngine.FRAME_MAGIC_TILES, magic);

        // 3. Receive batch header
        byte[] headerBytes = new byte[6];
        int hRead = 0;
        while (hRead < 6)
        {
            int r = await stream.ReadAsync(headerBytes.AsMemory(hRead, 6 - hRead), cts.Token);
            if (r == 0) break;
            hRead += r;
        }
        Assert.Equal(6, hRead);
        int width = BitConverter.ToInt16(headerBytes, 0);
        int height = BitConverter.ToInt16(headerBytes, 2);
        int tileCount = BitConverter.ToInt16(headerBytes, 4);

        Assert.True(width > 0);
        Assert.True(height > 0);
        Assert.True(tileCount > 0);

        // 4. Send input command
        await RemoteHostEngine.WriteCommandAsync(stream, new { t = "mm", x = 100, y = 100 }, cts.Token);
        await Task.Delay(50);
    }

    [Theory]
    [InlineData("ADMIN", true)]
    [InlineData("admin", true)]
    [InlineData("AGENT", true)]
    [InlineData("agent", true)]
    [InlineData("AGENT_OPERATIONAL_SUPPORT", true)]
    [InlineData("AGENT_ORACLE", true)]
    [InlineData("AGENT_WEB_DEV", true)]
    [InlineData("AGENT_ADMIN", true)]
    [InlineData("USER", false)]
    [InlineData("MANAGER", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    [InlineData("UNKNOWN_ROLE", false)]
    public void RemoteAccessPolicy_IsRemoteOperator_ValidatesRolesCorrectly(string? role, bool expected)
    {
        Assert.Equal(expected, RemoteAccessPolicy.IsRemoteOperator(role));
    }

    [Fact]
    public void RemoteAccessPolicy_FallbackIdentifier_AllowsAdminEmailOrName()
    {
        Assert.True(RemoteAccessPolicy.IsRemoteOperator("", "admin@idesk.com", "System Administrator"));
        Assert.True(RemoteAccessPolicy.IsRemoteOperator(null, "support_ict", "Helpdesk"));
        Assert.False(RemoteAccessPolicy.IsRemoteOperator("", "karyawan01", "Budi Santoso"));
    }
}
