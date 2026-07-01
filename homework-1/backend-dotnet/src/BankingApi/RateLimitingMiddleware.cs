using System.Collections.Concurrent;

namespace BankingApi;

/// In-memory, per-IP fixed-window rate limiter (Task 4D).
public class RateLimitingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly int _limit;
    private readonly TimeSpan _window;
    private readonly ConcurrentDictionary<string, (DateTime Start, int Count)> _hits = new();
    private readonly object _lock = new();

    public RateLimitingMiddleware(RequestDelegate next, int limit, int windowSeconds)
    {
        _next = next;
        _limit = limit;
        _window = TimeSpan.FromSeconds(windowSeconds);
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var ip = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        bool allowed;

        lock (_lock)
        {
            var now = DateTime.UtcNow;
            if (!_hits.TryGetValue(ip, out var window) || now - window.Start >= _window)
            {
                _hits[ip] = (now, 1);
                allowed = true;
            }
            else
            {
                window.Count++;
                _hits[ip] = window;
                allowed = window.Count <= _limit;
            }
        }

        if (!allowed)
        {
            context.Response.StatusCode = StatusCodes.Status429TooManyRequests;
            await context.Response.WriteAsJsonAsync(new
            {
                error = "Too Many Requests",
                message = $"Rate limit of {_limit} requests per minute exceeded",
            });
            return;
        }

        await _next(context);
    }
}
