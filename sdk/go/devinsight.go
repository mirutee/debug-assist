// Package devinsight captures panics and reports them to the DevInsight API.
//
// Usage:
//
//	func main() {
//	    devinsight.Wrap(run)
//	}
//
//	func run() {
//	    // your app code
//	}
package devinsight

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"runtime/debug"
	"strings"
	"time"
)

var (
	apiKey      = os.Getenv("DEVINSIGHT_API_KEY")
	baseURL     = strings.TrimRight(getEnv("DEVINSIGHT_BASE_URL", "https://devinsight-api.onrender.com"), "/")
	projectName = getEnv("DEVINSIGHT_PROJECT", "unknown")
	enabled     = os.Getenv("DEVINSIGHT_ENABLED") != "0"
)

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// Wrap runs fn and captures any panic, reporting it to DevInsight before re-panicking.
// This is the required one-liner for Go apps — place it as the first call in main().
func Wrap(fn func()) {
	defer func() {
		if r := recover(); r != nil {
			stack := string(debug.Stack())
			send(fmt.Sprintf("%v", r), "panic", stack)
			panic(r) // re-panic: preserves original crash behavior
		}
	}()
	fn()
}

func send(message, exceptionType, stack string) {
	if !enabled || apiKey == "" {
		return
	}

	payload := map[string]interface{}{
		"tipo":     "silent_backend_error",
		"mensagem": message,
		"contexto": map[string]string{
			"project_name":   projectName,
			"exception_type": exceptionType,
			"stack":          stack,
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		fmt.Fprintf(os.Stderr, "[DevInsight] Falha ao serializar payload: %v\n", err)
		return
	}

	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest(http.MethodPost, baseURL+"/v1/diagnosticos", bytes.NewReader(body))
	if err != nil {
		fmt.Fprintf(os.Stderr, "[DevInsight] Falha ao criar requisição: %v\n", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := client.Do(req)
	if err != nil {
		fmt.Fprintf(os.Stderr, "[DevInsight] Falha ao enviar diagnóstico: %v\n", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		fmt.Fprintf(os.Stderr, "[DevInsight] Servidor retornou erro: status %d\n", resp.StatusCode)
	}
}
