package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

func main() {
	targetURL := os.Getenv("X402_INTEROP_TARGET_URL")
	if targetURL == "" {
		panic("X402_INTEROP_TARGET_URL is required")
	}

	response, err := http.Get(targetURL)
	if err != nil {
		panic(err)
	}
	defer response.Body.Close()

	body, err := io.ReadAll(response.Body)
	if err != nil {
		panic(err)
	}

	headers := map[string]string{}
	for key, values := range response.Header {
		if len(values) > 0 {
			headers[key] = values[0]
		}
	}

	payload := map[string]any{
		"type":            "result",
		"implementation":  "go",
		"role":            "client",
		"ok":              false,
		"status":          response.StatusCode,
		"responseHeaders": headers,
		"responseBody": map[string]any{
			"error":           "go_exact_client_not_implemented",
			"challengeStatus": response.StatusCode,
			"challengeBody":   string(body),
		},
		"settlement": nil,
	}

	encoded, err := json.Marshal(payload)
	if err != nil {
		panic(err)
	}
	fmt.Println(string(encoded))
}
