using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;

namespace DebugAssistSDK
{
    /// <summary>
    /// DebugAssist SDK for C# — auto-captures unhandled exceptions and reports them to DebugAssist.
    ///
    /// Usage (one line in Program.cs):
    ///   DebugAssist.EnsureInitialized();
    ///
    /// Or with explicit key:
    ///   DebugAssist.Init("YOUR_API_KEY", "my-project");
    ///
    /// Configuration via env vars:
    ///   DEBUG_ASSIST_API_KEY   — your API key
    ///   DEBUG_ASSIST_BASE_URL  — base URL (default: https://debug-assist.onrender.com)
    ///   DEBUG_ASSIST_PROJECT   — project name (default: unknown)
    ///   DEBUG_ASSIST_ENABLED=0 — disable SDK
    /// </summary>
    public static class DebugAssist
    {
        private static string _apiKey      = Environment.GetEnvironmentVariable("DEBUG_ASSIST_API_KEY") ?? string.Empty;
        private static string _baseUrl     = (Environment.GetEnvironmentVariable("DEBUG_ASSIST_BASE_URL") ?? "https://debug-assist.onrender.com").TrimEnd('/');
        private static string _projectName = Environment.GetEnvironmentVariable("DEBUG_ASSIST_PROJECT") ?? "unknown";
        private static bool   _enabled     = Environment.GetEnvironmentVariable("DEBUG_ASSIST_ENABLED") != "0";
        private static bool   _initialized = false;
        private static readonly object _lock = new object();

        // Static HttpClient — reuse across calls (avoid socket exhaustion)
        private static readonly HttpClient _http = new HttpClient
        {
            Timeout = TimeSpan.FromSeconds(10)
        };

        /// <summary>Triggers initialization from env vars. Place at the top of Program.cs.</summary>
        public static void EnsureInitialized() => RegisterHandlers();

        /// <summary>Initializes with an explicit API key.</summary>
        public static void Init(string apiKey, string projectName = "unknown")
        {
            lock (_lock)
            {
                _apiKey      = apiKey;
                _projectName = projectName;
            }
            RegisterHandlers();
        }

        private static void RegisterHandlers()
        {
            lock (_lock)
            {
                if (_initialized) return;
                if (!_enabled || string.IsNullOrWhiteSpace(_apiKey)) return;
                _initialized = true;
            }

            AppDomain.CurrentDomain.UnhandledException += (_, args) =>
            {
                if (args.ExceptionObject is Exception ex)
                    SendSync(ex.Message, ex.GetType().FullName ?? "Exception", ex.StackTrace ?? string.Empty);
            };

            TaskScheduler.UnobservedTaskException += (_, args) =>
            {
                args.SetObserved();
                var inner = args.Exception.InnerException ?? (Exception)args.Exception;
                SendSync(
                    inner.Message,
                    inner.GetType().FullName ?? "Exception",
                    inner.StackTrace ?? string.Empty
                );
            };
        }

        private static void SendSync(string message, string exceptionType, string stack)
        {
            try
            {
                var payload = JsonSerializer.Serialize(new
                {
                    tipo     = "silent_backend_error",
                    mensagem = message,
                    contexto = new
                    {
                        project_name    = _projectName,
                        exception_type  = exceptionType,
                        stack
                    }
                });

                using var request = new HttpRequestMessage(HttpMethod.Post, $"{_baseUrl}/v1/diagnosticos")
                {
                    Content = new StringContent(payload, Encoding.UTF8, "application/json")
                };
                request.Headers.TryAddWithoutValidation("Authorization", $"Bearer {_apiKey}");

                _http.Send(request);
            }
            catch (Exception e)
            {
                Console.Error.WriteLine($"[DebugAssist] Falha ao enviar diagnóstico: {e.Message}");
            }
        }
    }
}
