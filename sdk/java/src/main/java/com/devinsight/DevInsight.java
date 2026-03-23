package com.devinsight;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

public final class DevInsight {

    private static final String DEFAULT_BASE_URL = "https://devinsight-api.onrender.com";
    private static volatile boolean initialized = false;

    private DevInsight() {}

    /** Reads DEVINSIGHT_API_KEY from environment and registers the crash handler. */
    public static synchronized void init() {
        String apiKey = System.getenv("DEVINSIGHT_API_KEY");
        String project = envOr("DEVINSIGHT_PROJECT", "unknown");
        if (apiKey != null && !apiKey.isBlank()) {
            init(apiKey, project);
        }
    }

    /** Registers the crash handler with an explicit API key. */
    public static synchronized void init(String apiKey, String projectName) {
        if (initialized) return;
        if ("0".equals(System.getenv("DEVINSIGHT_ENABLED"))) return;
        if (apiKey == null || apiKey.isBlank()) return;

        initialized = true;

        final String key     = apiKey;
        final String project = projectName != null ? projectName : "unknown";
        final String base    = envOr("DEVINSIGHT_BASE_URL", DEFAULT_BASE_URL).replaceAll("/+$", "");

        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            send(key, base, project, throwable);
            System.exit(1);
        });
    }

    private static void send(String apiKey, String baseUrl, String projectName, Throwable t) {
        try {
            StringBuilder sb = new StringBuilder();
            for (StackTraceElement el : t.getStackTrace()) {
                sb.append("\tat ").append(el).append("\n");
            }
            String body = "{"
                + "\"tipo\":\"silent_backend_error\","
                + "\"mensagem\":" + jsonStr(t.getMessage()) + ","
                + "\"contexto\":{"
                +   "\"project_name\":"    + jsonStr(projectName) + ","
                +   "\"exception_type\":"  + jsonStr(t.getClass().getName()) + ","
                +   "\"stack\":"           + jsonStr(sb.toString())
                + "}}";

            HttpClient client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();

            HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/v1/diagnosticos"))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + apiKey)
                .timeout(Duration.ofSeconds(10))
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

            client.send(req, HttpResponse.BodyHandlers.discarding());
        } catch (Exception e) {
            System.err.println("[DevInsight] Falha ao enviar diagnóstico: " + e.getMessage());
        }
    }

    private static String envOr(String key, String fallback) {
        String v = System.getenv(key);
        return (v != null && !v.isBlank()) ? v : fallback;
    }

    private static String jsonStr(String value) {
        if (value == null) return "null";
        return "\"" + value
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "\\r")
            .replace("\t", "\\t")
            + "\"";
    }
}
