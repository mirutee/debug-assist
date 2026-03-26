<?php
/**
 * DebugAssist SDK for PHP
 *
 * Captures uncaught exceptions and fatal errors, reporting them to DebugAssist.
 *
 * Usage:
 *   require_once 'debug_assist.php'; // só isso
 *
 * Configuration (env vars or constants defined before require):
 *   DEBUG_ASSIST_API_KEY   — your API key
 *   DEBUG_ASSIST_BASE_URL  — base URL (default: https://api.debug-assist.app)
 *   DEBUG_ASSIST_PROJECT   — project name (default: unknown)
 *   DEBUG_ASSIST_ENABLED=0 — disable SDK
 */

(static function (): void {
    $apiKey  = (string) (getenv('DEBUG_ASSIST_API_KEY')  ?: (defined('DEBUG_ASSIST_API_KEY')  ? DEBUG_ASSIST_API_KEY  : ''));
    $baseUrl = rtrim((string) (getenv('DEBUG_ASSIST_BASE_URL') ?: (defined('DEBUG_ASSIST_BASE_URL') ? DEBUG_ASSIST_BASE_URL : 'https://api.debug-assist.app')), '/');
    $project = (string) (getenv('DEBUG_ASSIST_PROJECT')  ?: (defined('DEBUG_ASSIST_PROJECT')  ? DEBUG_ASSIST_PROJECT  : 'unknown'));
    $enabled = getenv('DEBUG_ASSIST_ENABLED') !== '0';

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
    $previousHandler = set_exception_handler(null);
    set_exception_handler(static function (\Throwable $e) use ($send, $previousHandler): void {
        $send($e->getMessage(), \get_class($e), $e->getTraceAsString());
        if ($previousHandler !== null) {
            ($previousHandler)($e);
        } else {
            throw $e; // restore default behavior
        }
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
