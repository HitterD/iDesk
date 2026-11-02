using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Threading;
using System.Threading.Tasks;

namespace SJANotificationApp
{
    public static class P2pConnectionSupport
    {
        public static string? ResolveLocalP2pIp(string serverHost, IEnumerable<string>? candidates = null)
        {
            IEnumerable<IPAddress> addresses;
            if (candidates == null)
            {
                addresses = Dns.GetHostAddresses(Dns.GetHostName());
            }
            else
            {
                addresses = candidates
                    .Select(value => IPAddress.TryParse(value, out var address) ? address : null)
                    .Where(address => address != null)
                    .Cast<IPAddress>();
            }

            string? serverSubnet = IPAddress.TryParse(serverHost, out var serverIp) && serverIp.AddressFamily == AddressFamily.InterNetwork
                ? string.Join('.', serverIp.GetAddressBytes().Take(3))
                : null;

            var privateAddresses = addresses
                .Where(address => address.AddressFamily == AddressFamily.InterNetwork && IsPrivateUnicast(address))
                .Select(address => address.ToString())
                .ToList();

            return privateAddresses.FirstOrDefault(address =>
                       serverSubnet != null && address.StartsWith($"{serverSubnet}.", StringComparison.Ordinal))
                   ?? privateAddresses.FirstOrDefault(address => address.StartsWith("10.", StringComparison.Ordinal));
        }

        private static bool IsPrivateUnicast(IPAddress address)
        {
            byte[] bytes = address.GetAddressBytes();
            return bytes[0] == 10 ||
                   (bytes[0] == 172 && bytes[1] >= 16 && bytes[1] <= 31) ||
                   (bytes[0] == 192 && bytes[1] == 168);
        }

        public static async Task<T> RunWithTimeoutAsync<T>(
            Func<CancellationToken, Task<T>> operation,
            TimeSpan timeout,
            CancellationToken cancellationToken)
        {
            using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeoutCts.CancelAfter(timeout);

            try
            {
                return await operation(timeoutCts.Token);
            }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                throw new TimeoutException($"Operasi P2P tidak selesai dalam {timeout.TotalSeconds:0.#} detik.");
            }
        }

        public static bool ShouldFallback(Exception exception) =>
            exception is TimeoutException ||
            exception is IOException ||
            exception is UnauthorizedAccessException;

        public static bool IsUsableDirectLanIp(string? ipAddress)
        {
            if (string.IsNullOrWhiteSpace(ipAddress)) return false;
            if (!IPAddress.TryParse(ipAddress, out var address)) return false;
            if (address.AddressFamily != AddressFamily.InterNetwork) return false;
            if (!IsPrivateUnicast(address)) return false;
            if (ipAddress.StartsWith("172.19.", StringComparison.Ordinal)) return false;
            return true;
        }
    }
}
