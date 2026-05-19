package main

import (
	"encoding/base64"
	"encoding/json"
	"testing"
)

func TestSelectSVMRequirementFromPaymentRequiredHeader(t *testing.T) {
	requirement := map[string]any{
		"scheme":  "exact",
		"network": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
		"asset":   "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
		"amount":  "1000",
	}
	envelope, err := json.Marshal(map[string]any{
		"x402Version": 2,
		"accepts":     []map[string]any{requirement},
	})
	if err != nil {
		t.Fatal(err)
	}

	selected := selectSVMRequirement(
		map[string]string{"PAYMENT-REQUIRED": base64.StdEncoding.EncodeToString(envelope)},
		"",
		"solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
		"exact",
	)

	if selected == nil {
		t.Fatal("expected selected requirement")
	}
	if selected.Asset != requirement["asset"] {
		t.Fatalf("unexpected asset: %s", selected.Asset)
	}
}

func TestSelectSVMRequirementFromBody(t *testing.T) {
	body, err := json.Marshal(map[string]any{
		"accepts": []map[string]any{
			{
				"scheme":  "exact",
				"network": "eip155:8453",
				"asset":   "0x0000000000000000000000000000000000000000",
				"amount":  "1000",
			},
			{
				"scheme":  "exact",
				"network": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
				"asset":   "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
				"amount":  "1000",
			},
		},
	})
	if err != nil {
		t.Fatal(err)
	}

	selected := selectSVMRequirement(
		map[string]string{},
		string(body),
		"solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
		"exact",
	)

	if selected == nil {
		t.Fatal("expected selected requirement")
	}
	if selected.Network != "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1" {
		t.Fatalf("unexpected network: %s", selected.Network)
	}
}

func TestSelectSVMRequirementIgnoresUnsupportedScheme(t *testing.T) {
	body, err := json.Marshal(map[string]any{
		"accepts": []map[string]any{
			{
				"scheme":  "upto",
				"network": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
				"asset":   "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
				"amount":  "1000",
			},
		},
	})
	if err != nil {
		t.Fatal(err)
	}

	selected := selectSVMRequirement(
		map[string]string{},
		string(body),
		"solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
		"exact",
	)

	if selected != nil {
		t.Fatalf("expected no selected requirement, got %+v", selected)
	}
}

func TestSelectSVMRequirementSupportsRequestedUptoScheme(t *testing.T) {
	body, err := json.Marshal(map[string]any{
		"accepts": []map[string]any{
			{
				"scheme":  "upto",
				"network": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
				"asset":   "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
				"amount":  "1000",
			},
		},
	})
	if err != nil {
		t.Fatal(err)
	}

	selected := selectSVMRequirement(
		map[string]string{},
		string(body),
		"solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
		"upto",
	)

	if selected == nil {
		t.Fatal("expected selected upto requirement")
	}
	if selected.Scheme != "upto" {
		t.Fatalf("unexpected scheme: %s", selected.Scheme)
	}
}
