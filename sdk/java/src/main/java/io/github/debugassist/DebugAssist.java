package io.github.debugassist;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

public final class DebugAssist {

    private static final String DEFAULT_BASE_URL = "https://api.debug-assist.app";
    private static boolean initialized = false;

    private DebugAssist() {}

    /** Reads DEBUG_ASSIST_API_KEY from environment and registers the crash handler. */
    public static synchronized void init() {
        String apiKey = System.getenv("DEBUG_ASSIST_API_KEY");
        String project = envOr("DEBUG_ASSIST_PROJECT", "unknown");
        if (apiKey != null && !apiKey.isBlank()) {
            init(apiKey, project);
        }
    }

    /** Registers the crash handler with an explicit API key. */
    public static synchronized void init(String apiKey, String projectName) {
        if (initialized) return;
        if ("0".equals(System.getenv("DEBUG_ASSIST_ENABLED"))) return;
        if (apiKey == null || apiKey.isBlank()) return;

        initialized = true;

        final String key     = apiKey;
        final String project = projectName != null ? projectName : "unknown";
        final String base    = envOr("DEBUG_ASSIST_BASE_URL", DEFAULT_BASE_URL).replaceAll("/+$", "");

        final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

        Thread.UncaughtExceptionHandler previous = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            send(key, base, project, throwable, httpClient);
            if (previous != null) {
                previous.uncaughtException(thread, throwable);
            } else {
                System.exit(1);
            }
        });
    }

    private static void send(String apiKey, String baseUrl, String projectName, Throwable t, HttpClient httpClient) {
        try {
            StringBuilder sb = new StringBuilder();
            for (StackTraceElement el : t.getStackTrace()) {
                sb.append("\tat ").append(el).append("\n");
            }
            String body = "{"
                + "\"tipo\":\"silent_backend_error\","
                + "\"mensagem\":" + jsonStr(t.getMessage() != null ? t.getMessage() : t.getClass().getSimpleName()) + ","
                + "\"contexto\":{"
                +   "\"project_name\":"    + jsonStr(projectName) + ","
                +   "\"exception_type\":"  + jsonStr(t.getClass().getName()) + ","
                +   "\"stack\":"           + jsonStr(sb.toString())
                + "}}";

            HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/v1/diagnosticos"))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + apiKey)
                .timeout(Duration.ofSeconds(10))
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

            httpClient.send(req, HttpResponse.BodyHandlers.discarding());
        } catch (Exception e) {
            System.err.println("[DebugAssist] Falha ao enviar diagnóstico: " + e.getMessage());
        }
    }

    private static String envOr(String key, String fallback) {
        String v = System.getenv(key);
        return (v != null && !v.isBlank()) ? v : fallback;
    }

    private static String jsonStr(String value) {
        if (value == null) return "null";
        StringBuilder sb = new StringBuilder("\"");
        for (char c : value.toCharArray()) {
            switch (c) {
                case '\\': sb.append("\\\\"); break;
                case '"':  sb.append("\\\""); break;
                case '\n': sb.append("\\n");  break;
                case '\r': sb.append("\\r");  break;
                case '\t': sb.append("\\t");  break;
                default:
                    if (c < 0x20) {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
            }
        }
        sb.append('"');
        return sb.toString();
    }
}
