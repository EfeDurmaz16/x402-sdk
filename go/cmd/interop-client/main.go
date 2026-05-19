package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
)

type paymentEnvelope struct {
	Accepts []paymentRequirement `json:"accepts"`
}

type paymentRequirement struct {
	Scheme  string `json:"scheme"`
	Network string `json:"network"`
	Asset   string `json:"asset"`
	Amount  string `json:"amount"`
}

func headerValue(headers map[string]string, name string) string {
	for key, value := range headers {
		if strings.EqualFold(key, name) {
			return value
		}
	}
	return ""
}

func loadPaymentRequiredHeader(headers map[string]string) *paymentEnvelope {
	encoded := headerValue(headers, "PAYMENT-REQUIRED")
	if encoded == "" {
		return nil
	}

	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return nil
	}

	var envelope paymentEnvelope
	if err := json.Unmarshal(decoded, &envelope); err != nil {
		return nil
	}
	return &envelope
}

func loadPaymentRequiredBody(body string) *paymentEnvelope {
	if body == "" {
		return nil
	}

	var envelope paymentEnvelope
	if err := json.Unmarshal([]byte(body), &envelope); err != nil {
		return nil
	}
	return &envelope
}

func selectSVMRequirement(headers map[string]string, body string, network string, scheme string) *paymentRequirement {
	envelopes := []*paymentEnvelope{
		loadPaymentRequiredHeader(headers),
		loadPaymentRequiredBody(body),
	}

	for _, envelope := range envelopes {
		if envelope == nil {
			continue
		}
		for _, requirement := range envelope.Accepts {
			if requirement.Scheme != scheme {
				continue
			}
			if requirement.Network != network {
				continue
			}
			if requirement.Asset == "" || requirement.Amount == "" {
				continue
			}
			selected := requirement
			return &selected
		}
	}

	return nil
}

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
	selectedRequirement := selectSVMRequirement(
		headers,
		string(body),
		readEnvWithDefault("X402_INTEROP_NETWORK", "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"),
		readEnvWithDefault("X402_INTEROP_SCHEME", "exact"),
	)
	scheme := readEnvWithDefault("X402_INTEROP_SCHEME", "exact")
	errorDomain := readEnvWithDefault("X402_INTEROP_INTENT", scheme)

	payload := map[string]any{
		"type":            "result",
		"implementation":  "go",
		"role":            "client",
		"ok":              false,
		"status":          response.StatusCode,
		"responseHeaders": headers,
		"responseBody": map[string]any{
			"error":               fmt.Sprintf("go_%s_client_not_implemented", errorDomain),
			"challengeStatus":     response.StatusCode,
			"challengeBody":       string(body),
			"selectedRequirement": selectedRequirement,
		},
		"settlement": nil,
	}

	encoded, err := json.Marshal(payload)
	if err != nil {
		panic(err)
	}
	fmt.Println(string(encoded))
}

func readEnvWithDefault(name string, fallback string) string {
	value := os.Getenv(name)
	if value == "" {
		return fallback
	}
	return value
}
