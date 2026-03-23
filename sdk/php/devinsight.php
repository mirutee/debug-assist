<?php
/**
 * DevInsight SDK for PHP
 *
 * Captures uncaught exceptions and fatal errors, reporting them to DevInsight.
 *
 * Usage:
 *   require_once 'devinsight.php'; // só isso
 *
 * Configuration (env vars or constants defined before require):
 *   DEVINSIGHT_API_KEY   — your API key
 *   DEVINSIGHT_BASE_URL  — base URL (default: https://devinsight-api.onrender.com)
 *   DEVINSIGHT_PROJECT   — project name (default: unknown)
 *   DEVINSIGHT_ENABLED=0 — disable SDK
 */

(static function (): void {
    $apiKey  = (string) (getenv('DEVINSIGHT_API_KEY')  ?: (defined('DEVINSIGHT_API_KEY')  ? DEVINSIGHT_API_KEY  : ''));
    $baseUrl = rtrim((string) (getenv('DEVINSIGHT_BASE_URL') ?: (defined('DEVINSIGHT_BASE_URL') ? DEVINSIGHT_BASE_URL : 'https://devinsight-api.onrender.com')), '/');
    $project = (string) (getenv('DEVINSIGHT_PROJECT')  ?: (defined('DEVINSIGHT_PROJECT')  ? DEVINSIGHT_PROJECT  : 'unknown'));
    $enabled = getenv('DEVINSIGHT_ENABLED') !== '0';

    if (!$enabled || $apiKey === '') {
        return;
    }

    $send = static function (string $message, string $type, string $stack) use ($apiKey, $baseUrl, $project): void {
        $body = (string) json_encode([
            'tipo'     => 'silent_backend_error',
            'mensagem' => $message,
            'contexto' => [
                'project_name'   => $project,
                'exception_type' => $type,
                'stack'          => $stack,
            ],
        ]);

        $url = $baseUrl . '/v1/diagnosticos';
        $headers = "Content-Type: application/json\r\nAuthorization: Bearer {$apiKey}";

        if (ini_get('allow_url_fopen')) {
            $ctx = stream_context_create([
                'http' => [
                    'method'        => 'POST',
                    'header'        => $headers,
                    'content'       => $body,
                    'timeout'       => 10,
                    'ignore_errors' => true,
                ],
            ]);
            @file_get_contents($url, false, $ctx);
        } elseif (function_exists('curl_init')) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_POST           => true,
                CURLOPT_POSTFIELDS     => $body,
                CURLOPT_HTTPHEADER     => ['Content-Type: application/json', "Authorization: Bearer {$apiKey}"],
                CURLOPT_TIMEOUT        => 10,
                CURLOPT_RETURNTRANSFER => true,
            ]);
            curl_exec($ch);
            curl_close($ch);
        }
    };

    // Uncaught exceptions
    set_exception_handler(static function (\Throwable $e) use ($send): void {
        $send($e->getMessage(), \get_class($e), $e->getTraceAsString());
    });

    // Fatal errors (E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR)
    $fatalTypes = [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR];
    register_shutdown_function(static function () use ($send, $fatalTypes): void {
        $error = error_get_last();
        if ($error !== null && \in_array($error['type'], $fatalTypes, true)) {
            $send(
                $error['message'],
                'FatalError',
                $error['file'] . ':' . $error['line']
            );
        }
    });
})();
