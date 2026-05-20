package main

import (
	"bytes"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"strings"
	"syscall"
	"testing"
	"time"

	"github.com/gagliardetto/solana-go"
)

func TestNormalizeAmountUsesSixMintDecimals(t *testing.T) {
	tests := map[string]string{
		"$0.001":     "1000",
		"0.001 USDC": "1000",
		"1":          "1000000",
		"1.25":       "1250000",
	}

	for price, expected := range tests {
		if actual := normalizeAmount(price); actual != expected {
			t.Fatalf("normalizeAmount(%q) = %q, want %q", price, actual, expected)
		}
	}
}

func TestNormalizeAmountRejectsMalformedPrices(t *testing.T) {
	tests := []string{
		"not-a-price",
		"1.0000001",
		"1.bad",
	}

	for _, price := range tests {
		t.Run(price, func(t *testing.T) {
			mustPanic(t, func() {
				normalizeAmount(price)
			})
		})
	}
}

func TestEnvHelpersAndReadState(t *testing.T) {
	privateKey, err := solana.NewRandomPrivateKey()
	if err != nil {
		t.Fatal(err)
	}
	encodedKey, err := json.Marshal([]byte(privateKey))
	if err != nil {
		t.Fatal(err)
	}
	payTo := solana.NewWallet().PublicKey().String()

	t.Setenv("X402_INTEROP_RPC_URL", "http://rpc.test")
	t.Setenv("X402_INTEROP_PAY_TO", payTo)
	t.Setenv("X402_INTEROP_FACILITATOR_SECRET_KEY", string(encodedKey))
	t.Setenv("X402_INTEROP_NETWORK", "localnet")
	t.Setenv("X402_INTEROP_MINT", "USDG")
	t.Setenv("X402_INTEROP_PRICE", "$1.25")
	t.Setenv("X402_INTEROP_EXTRA_OFFERED_MINTS", " PYUSD, , CASH ")

	state := readState()
	if state.rpcURL != "http://rpc.test" || state.network != "localnet" || state.mint != "USDG" {
		t.Fatalf("unexpected state: %+v", state)
	}
	if state.payTo != payTo || !state.feePayer.PublicKey().Equals(privateKey.PublicKey()) {
		t.Fatalf("readState did not preserve configured keys")
	}
	if state.amount != "1250000" {
		t.Fatalf("amount = %s, want 1250000", state.amount)
	}
	if len(state.extraOfferedMints) != 2 || state.extraOfferedMints[0] != "PYUSD" || state.extraOfferedMints[1] != "CASH" {
		t.Fatalf("unexpected extra mints: %#v", state.extraOfferedMints)
	}
	if state.httpClient == nil {
		t.Fatal("expected readState to configure an HTTP client")
	}
	if got := readEnvWithDefault("X402_INTEROP_NETWORK", "fallback"); got != "localnet" {
		t.Fatalf("readEnvWithDefault configured = %q", got)
	}
	if got := readEnvWithDefault("X402_INTEROP_MISSING", "fallback"); got != "fallback" {
		t.Fatalf("readEnvWithDefault fallback = %q", got)
	}

	t.Setenv("X402_INTEROP_REQUIRED_EMPTY", "")
	mustPanic(t, func() {
		readRequiredEnv("X402_INTEROP_REQUIRED_EMPTY")
	})
	mustPanic(t, func() {
		keypairFromJSONSecret("[1,2,3]")
	})
	mustPanic(t, func() {
		keypairFromJSONSecret("{")
	})
}

func TestJSONWritersAndChallengePayloads(t *testing.T) {
	recorder := httptest.NewRecorder()
	writeJSON(recorder, http.StatusAccepted, map[string]any{"ok": true})
	if recorder.Code != http.StatusAccepted {
		t.Fatalf("status = %d", recorder.Code)
	}
	if recorder.Header().Get("content-type") != "application/json" {
		t.Fatalf("unexpected content type: %s", recorder.Header().Get("content-type"))
	}
	if strings.TrimSpace(recorder.Body.String()) != `{"ok":true}` {
		t.Fatalf("unexpected JSON body: %s", recorder.Body.String())
	}

	recorder = httptest.NewRecorder()
	writeJSONWithHeaders(recorder, http.StatusCreated, map[string]string{"x-test": "value"}, map[string]any{"created": true})
	if recorder.Code != http.StatusCreated || recorder.Header().Get("x-test") != "value" {
		t.Fatalf("headers/status not written: %d %v", recorder.Code, recorder.Header())
	}

	capabilities := capabilityPayload("go")
	if capabilities["implementation"] != "go" || capabilities["role"] != "server" {
		t.Fatalf("unexpected capability payload: %#v", capabilities)
	}
	if got := len(capabilities["capabilities"].([]string)); got != 1 {
		t.Fatalf("expected one implemented capability, got %d", got)
	}

	state := testServerState(t)
	state.memo = "bound-memo"
	exact := exactChallengePayload(state)
	if exact.X402Version != 2 || exact.Resource["uri"] != defaultResourcePath {
		t.Fatalf("unexpected exact challenge: %+v", exact)
	}
	if exact.Accepts[0].Extra["memo"] != "bound-memo" {
		t.Fatalf("expected exact requirement to include memo")
	}
	if uptoChallengePayload()["x402Version"] != 2 {
		t.Fatal("expected x402 upto challenge")
	}
	if sessionChallengePayload()["intent"] != "session" {
		t.Fatal("expected session challenge intent")
	}
	if batchSettlementChallengePayload()["x402Version"] != 2 {
		t.Fatal("expected batch settlement challenge")
	}
}

func TestPaymentRequiredWritersEncodeChallenges(t *testing.T) {
	state := testServerState(t)

	recorder := httptest.NewRecorder()
	writePaymentRequired(recorder, uptoChallengePayload())
	if recorder.Code != http.StatusPaymentRequired {
		t.Fatalf("status = %d", recorder.Code)
	}
	decoded, err := base64.StdEncoding.DecodeString(recorder.Header().Get("PAYMENT-REQUIRED"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(decoded), `"scheme":"upto"`) {
		t.Fatalf("unexpected encoded challenge: %s", string(decoded))
	}

	recorder = httptest.NewRecorder()
	writeExactPaymentRequired(recorder, state)
	decoded, err = base64.StdEncoding.DecodeString(recorder.Header().Get("PAYMENT-REQUIRED"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(decoded), `"scheme":"exact"`) {
		t.Fatalf("unexpected exact challenge: %s", string(decoded))
	}
}

func TestDefaultTokenProgramForMintHandlesAliasesAndMints(t *testing.T) {
	tests := map[string]string{
		" PYUSD ": token2022Program,
		"USDG":    token2022Program,
		"CASH":    token2022Program,
		"CXk2AMBfi3TwaEL2468s6zP8xq9NxTXjp9gjMgzeUynM": token2022Program,
		"4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU": defaultTokenProgram,
	}

	for mint, want := range tests {
		t.Run(mint, func(t *testing.T) {
			if got := defaultTokenProgramForMint(mint); got != want {
				t.Fatalf("defaultTokenProgramForMint(%q) = %q, want %q", mint, got, want)
			}
		})
	}
}

func TestPaymentRequirementMatchesBindsSettlementFields(t *testing.T) {
	feePayer := solana.NewWallet().PrivateKey
	state := serverState{
		network:  "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
		mint:     "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
		payTo:    solana.NewWallet().PublicKey().String(),
		feePayer: feePayer,
		amount:   "1000",
	}

	requirement := exactRequirement(state)
	if !paymentRequirementMatches(requirement, requirement) {
		t.Fatal("expected matching requirement to pass")
	}

	mutated := requirement
	mutated.Extra = map[string]any{
		"decimals":     defaultDecimals,
		"feePayer":     solana.NewWallet().PublicKey().String(),
		"tokenProgram": defaultTokenProgram,
	}
	if paymentRequirementMatches(mutated, requirement) {
		t.Fatal("expected fee payer mutation to be rejected")
	}
}

func TestPaymentRequirementMatchesRejectsExactRequirementDrift(t *testing.T) {
	feePayer := solana.NewWallet().PrivateKey
	state := serverState{
		network:  "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
		mint:     "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
		payTo:    solana.NewWallet().PublicKey().String(),
		feePayer: feePayer,
		amount:   "1000",
	}

	requirement := exactRequirement(state)
	tests := map[string]func(paymentRequirement) paymentRequirement{
		"scheme": func(value paymentRequirement) paymentRequirement {
			value.Scheme = "upto"
			return value
		},
		"network": func(value paymentRequirement) paymentRequirement {
			value.Network = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"
			return value
		},
		"asset": func(value paymentRequirement) paymentRequirement {
			value.Asset = solana.NewWallet().PublicKey().String()
			return value
		},
		"amount": func(value paymentRequirement) paymentRequirement {
			value.Amount = "2000"
			return value
		},
		"payTo": func(value paymentRequirement) paymentRequirement {
			value.PayTo = solana.NewWallet().PublicKey().String()
			return value
		},
		"maxTimeoutSeconds": func(value paymentRequirement) paymentRequirement {
			value.MaxTimeoutSeconds = defaultMaxTimeout + 1
			return value
		},
		"extra.tokenProgram": func(value paymentRequirement) paymentRequirement {
			value.Extra = cloneExtra(value.Extra)
			value.Extra["tokenProgram"] = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
			return value
		},
		"extra.unexpected": func(value paymentRequirement) paymentRequirement {
			value.Extra = cloneExtra(value.Extra)
			value.Extra["memo"] = "drift"
			return value
		},
	}

	for name, mutate := range tests {
		t.Run(name, func(t *testing.T) {
			if paymentRequirementMatches(mutate(requirement), requirement) {
				t.Fatalf("expected %s drift to be rejected", name)
			}
		})
	}
}

func TestExactChallengeIncludesExtraOfferedMints(t *testing.T) {
	feePayer := solana.NewWallet().PrivateKey
	state := serverState{
		network:           "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
		mint:              "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
		payTo:             solana.NewWallet().PublicKey().String(),
		feePayer:          feePayer,
		amount:            "1000",
		extraOfferedMints: []string{"CXk2AMBfi3TwaEL2468s6zP8xq9NxTXjp9gjMgzeUynM"},
	}

	challenge := exactChallengePayload(state)

	if len(challenge.Accepts) != 2 {
		t.Fatalf("expected primary plus extra mint offers, got %d", len(challenge.Accepts))
	}
	if challenge.Accepts[0].Asset != state.mint {
		t.Fatalf("expected primary mint first, got %s", challenge.Accepts[0].Asset)
	}
	if challenge.Accepts[1].Asset != state.extraOfferedMints[0] {
		t.Fatalf("expected extra mint second, got %s", challenge.Accepts[1].Asset)
	}
	if challenge.Accepts[1].Extra["tokenProgram"] != "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb" {
		t.Fatalf("expected PYUSD offer to use Token-2022, got %v", challenge.Accepts[1].Extra["tokenProgram"])
	}
}

func TestSettleExactPaymentRejectsMalformedPaymentSignature(t *testing.T) {
	state := testServerState(t)
	state.memo = "unit-duplicate"

	tests := map[string]string{
		"base64": "not base64",
		"json":   base64.StdEncoding.EncodeToString([]byte("{")),
	}

	for name, header := range tests {
		t.Run(name, func(t *testing.T) {
			if _, err := settleExactPayment(state, header); err == nil {
				t.Fatal("expected malformed payment signature to be rejected")
			}
		})
	}
}

func TestSettleExactPaymentRejectsMissingAndInvalidTransactionPayload(t *testing.T) {
	state := testServerState(t)
	requirement := exactRequirement(state)
	tests := map[string]map[string]string{
		"missing": {},
		"invalid": {"transaction": "not a transaction"},
	}

	for name, payload := range tests {
		t.Run(name, func(t *testing.T) {
			header := encodePaymentSignatureForTest(t, paymentSignatureEnvelope{
				X402Version: 2,
				Accepted:    requirement,
				Payload:     payload,
			})

			if _, err := settleExactPayment(state, header); err == nil {
				t.Fatal("expected transaction payload to be rejected")
			}
		})
	}
}

func TestSettleExactPaymentRejectsVersionAndRequirementMismatch(t *testing.T) {
	state := testServerState(t)
	requirement := exactRequirement(state)

	versionHeader := encodePaymentSignatureForTest(t, paymentSignatureEnvelope{
		X402Version: 1,
		Accepted:    requirement,
		Payload:     map[string]string{"transaction": "unused"},
	})
	if _, err := settleExactPayment(state, versionHeader); err == nil || err.Error() != "unsupported x402Version: 1" {
		t.Fatalf("expected version rejection, got %v", err)
	}

	drifted := requirement
	drifted.Amount = "999"
	driftHeader := encodePaymentSignatureForTest(t, paymentSignatureEnvelope{
		X402Version: 2,
		Accepted:    drifted,
		Payload:     map[string]string{"transaction": "unused"},
	})
	if _, err := settleExactPayment(state, driftHeader); err == nil || err.Error() != "accepted payment requirement does not match server challenge" {
		t.Fatalf("expected requirement mismatch, got %v", err)
	}
}

func TestSettleExactPaymentRejectsDuplicateTransactionPayload(t *testing.T) {
	settlementCache = newDuplicateSettlementCache()
	client, err := solana.NewRandomPrivateKey()
	if err != nil {
		t.Fatal(err)
	}
	state := testServerState(t)
	state.memo = "unit-duplicate"
	sendCalls := 0
	state.httpClient = &http.Client{
		Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
			rawBody, err := io.ReadAll(request.Body)
			if err != nil {
				t.Fatal(err)
			}
			body := string(rawBody)
			responseBody := `{"jsonrpc":"2.0","id":1,"result":{"value":{"data":["","base64"]}}}`
			if strings.Contains(body, `"method":"sendTransaction"`) {
				sendCalls++
				responseBody = `{"jsonrpc":"2.0","id":1,"result":"unit-settlement"}`
			}
			return &http.Response{
				StatusCode: http.StatusOK,
				Header:     http.Header{"content-type": []string{"application/json"}},
				Body:       io.NopCloser(strings.NewReader(responseBody)),
			}, nil
		}),
	}
	defer func() {
		settlementCache = newDuplicateSettlementCache()
	}()
	requirement := exactRequirement(state)
	transaction := signedTransactionForTest(t, requirement, client)

	header := encodePaymentSignatureForTest(t, paymentSignatureEnvelope{
		X402Version: 2,
		Accepted:    requirement,
		Payload: map[string]string{
			"transaction": transaction,
		},
	})

	if settlement, err := settleExactPayment(state, header); err != nil || settlement != "unit-settlement" {
		t.Fatalf("first settlement = %q, %v", settlement, err)
	}
	if _, err := settleExactPayment(state, header); err == nil || err.Error() != "duplicate_settlement" {
		t.Fatalf("expected duplicate_settlement, got %v", err)
	}
	if sendCalls != 1 {
		t.Fatalf("expected one sendTransaction call, got %d", sendCalls)
	}
}

func TestSettleExactPaymentReleasesDuplicateCacheOnTokenAccountFailure(t *testing.T) {
	settlementCache = newDuplicateSettlementCache()
	defer func() {
		settlementCache = newDuplicateSettlementCache()
	}()
	client, err := solana.NewRandomPrivateKey()
	if err != nil {
		t.Fatal(err)
	}
	state := testServerState(t)
	state.memo = "unit-missing-ata"
	state.httpClient = &http.Client{
		Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
			rawBody, err := io.ReadAll(request.Body)
			if err != nil {
				t.Fatal(err)
			}
			if strings.Contains(string(rawBody), `"method":"getAccountInfo"`) {
				return &http.Response{
					StatusCode: http.StatusOK,
					Header:     http.Header{"content-type": []string{"application/json"}},
					Body:       io.NopCloser(strings.NewReader(`{"jsonrpc":"2.0","id":1,"result":{"context":{"slot":1},"value":null}}`)),
				}, nil
			}
			t.Fatalf("unexpected RPC body: %s", string(rawBody))
			return nil, nil
		}),
	}
	requirement := exactRequirement(state)
	header := encodePaymentSignatureForTest(t, paymentSignatureEnvelope{
		X402Version: 2,
		Accepted:    requirement,
		Payload: map[string]string{
			"transaction": signedTransactionForTest(t, requirement, client),
		},
	})

	if _, err := settleExactPayment(state, header); err == nil || err.Error() != "source token account does not exist" {
		t.Fatalf("expected missing source account, got %v", err)
	}
	if _, err := settleExactPayment(state, header); err == nil || err.Error() != "source token account does not exist" {
		t.Fatalf("expected failed settlement to release duplicate cache, got %v", err)
	}
}

func TestVerifyExactTransactionRejectsSpecViolations(t *testing.T) {
	client, err := solana.NewRandomPrivateKey()
	if err != nil {
		t.Fatal(err)
	}
	state := testServerState(t)
	state.memo = "unit-spec"
	requirement := exactRequirement(state)
	valid := transactionForTest(t, requirement, client)

	tests := map[string]struct {
		mutate func(*solana.Transaction)
		want   string
	}{
		"compute price too high": {
			mutate: func(tx *solana.Transaction) {
				tx.Message.Instructions[1].Data = computePriceDataForTest(maxComputeUnitPrice + 1)
			},
			want: "invalid_exact_svm_payload_transaction_instructions_compute_price_instruction_too_high",
		},
		"amount mismatch": {
			mutate: func(tx *solana.Transaction) {
				data := []byte{12}
				data = binary.LittleEndian.AppendUint64(data, 999)
				data = append(data, byte(defaultDecimals))
				tx.Message.Instructions[2].Data = data
			},
			want: "invalid_exact_svm_payload_transaction_amount",
		},
		"missing memo": {
			mutate: func(tx *solana.Transaction) {
				tx.Message.Instructions = tx.Message.Instructions[:3]
			},
			want: "invalid_exact_svm_payload_transaction_memo",
		},
		"fee payer instruction account": {
			mutate: func(tx *solana.Transaction) {
				tx.Message.Instructions[2].Accounts[0] = 0
			},
			want: "invalid_exact_svm_payload_transaction_fee_payer_transferring_funds",
		},
		"mint mismatch": {
			mutate: func(tx *solana.Transaction) {
				tx.Message.AccountKeys = append(tx.Message.AccountKeys, solana.NewWallet().PublicKey())
				tx.Message.Instructions[2].Accounts[1] = uint16(len(tx.Message.AccountKeys) - 1)
			},
			want: "invalid_exact_svm_payload_transaction_mint",
		},
		"decimals mismatch": {
			mutate: func(tx *solana.Transaction) {
				data := []byte{12}
				data = binary.LittleEndian.AppendUint64(data, 1000)
				data = append(data, byte(defaultDecimals+1))
				tx.Message.Instructions[2].Data = data
			},
			want: "invalid_exact_svm_payload_transaction_decimals",
		},
		"memo mismatch": {
			mutate: func(tx *solana.Transaction) {
				tx.Message.Instructions[3].Data = []byte("wrong")
			},
			want: "invalid_exact_svm_payload_transaction_memo",
		},
		"unknown fourth instruction": {
			mutate: func(tx *solana.Transaction) {
				tx.Message.Instructions[3] = compiledInstructionForTest(t, tx, solana.SystemProgramID.String(), nil)
			},
			want: "invalid_exact_svm_payload_unknown_fourth_instruction",
		},
	}

	for name, test := range tests {
		t.Run(name, func(t *testing.T) {
			tx := cloneTransactionForTest(t, valid)
			test.mutate(tx)
			if err := verifyExactTransaction(tx, requirement); err == nil || err.Error() != test.want {
				t.Fatalf("expected %q, got %v", test.want, err)
			}
		})
	}
}

func TestVerifyExactTransactionRejectsMalformedInstructionShapes(t *testing.T) {
	client, err := solana.NewRandomPrivateKey()
	if err != nil {
		t.Fatal(err)
	}
	state := testServerState(t)
	state.memo = "unit-shapes"
	requirement := exactRequirement(state)
	valid := transactionForTest(t, requirement, client)

	tests := map[string]struct {
		mutate func(*solana.Transaction)
		want   string
	}{
		"legacy transaction": {
			mutate: func(tx *solana.Transaction) {
				tx.Message.SetVersion(solana.MessageVersionLegacy)
			},
			want: "payment transaction must be versioned",
		},
		"too few instructions": {
			mutate: func(tx *solana.Transaction) {
				tx.Message.Instructions = tx.Message.Instructions[:2]
			},
			want: "invalid_exact_svm_payload_transaction_instructions_length",
		},
		"bad compute limit": {
			mutate: func(tx *solana.Transaction) {
				tx.Message.Instructions[0].Data = []byte{2}
			},
			want: "invalid_exact_svm_payload_transaction_instructions_compute_limit_instruction",
		},
		"bad compute price": {
			mutate: func(tx *solana.Transaction) {
				tx.Message.Instructions[1].Data = []byte{3}
			},
			want: "invalid_exact_svm_payload_transaction_instructions_compute_price_instruction",
		},
		"bad transfer program": {
			mutate: func(tx *solana.Transaction) {
				tx.Message.Instructions[2] = compiledInstructionForTest(t, tx, solana.SystemProgramID.String(), []byte{12})
			},
			want: "invalid_exact_svm_payload_transaction_transfer_program",
		},
		"bad transfer data": {
			mutate: func(tx *solana.Transaction) {
				tx.Message.Instructions[2].Data = []byte{12}
			},
			want: "invalid_exact_svm_payload_transaction_transfer_checked",
		},
	}

	for name, test := range tests {
		t.Run(name, func(t *testing.T) {
			tx := cloneTransactionForTest(t, valid)
			test.mutate(tx)
			if err := verifyExactTransaction(tx, requirement); err == nil || err.Error() != test.want {
				t.Fatalf("expected %q, got %v", test.want, err)
			}
		})
	}
}

func TestParseTransferCheckedInstructionRejectsInvalidAccountIndexes(t *testing.T) {
	client, err := solana.NewRandomPrivateKey()
	if err != nil {
		t.Fatal(err)
	}
	state := testServerState(t)
	state.memo = "unit-transfer-indexes"
	tx := transactionForTest(t, exactRequirement(state), client)
	instruction := tx.Message.Instructions[2]

	tests := map[string]int{
		"source":      0,
		"mint":        1,
		"destination": 2,
		"authority":   3,
	}

	for name, accountIndex := range tests {
		t.Run(name, func(t *testing.T) {
			mutated := instruction
			mutated.Accounts = append([]uint16(nil), instruction.Accounts...)
			mutated.Accounts[accountIndex] = uint16(len(tx.Message.AccountKeys))
			if _, err := parseTransferCheckedInstruction(tx, mutated); err == nil {
				t.Fatal("expected invalid account index")
			}
		})
	}
}

func TestVerifyExactTransactionRejectsMalformedRequirementFields(t *testing.T) {
	client, err := solana.NewRandomPrivateKey()
	if err != nil {
		t.Fatal(err)
	}
	state := testServerState(t)
	state.memo = "unit-requirement-fields"
	requirement := exactRequirement(state)
	valid := transactionForTest(t, requirement, client)

	tests := map[string]struct {
		mutate func(paymentRequirement) paymentRequirement
		want   string
	}{
		"fee payer": {
			mutate: func(value paymentRequirement) paymentRequirement {
				value.Extra = cloneExtra(value.Extra)
				value.Extra["feePayer"] = "not-base58"
				return value
			},
			want: "invalid feePayer:",
		},
		"asset": {
			mutate: func(value paymentRequirement) paymentRequirement {
				value.Asset = "not-base58"
				return value
			},
			want: "invalid asset:",
		},
		"amount": {
			mutate: func(value paymentRequirement) paymentRequirement {
				value.Amount = "not-int"
				return value
			},
			want: "invalid amount:",
		},
		"payTo": {
			mutate: func(value paymentRequirement) paymentRequirement {
				value.PayTo = "not-base58"
				return value
			},
			want: "invalid payTo:",
		},
	}

	for name, test := range tests {
		t.Run(name, func(t *testing.T) {
			err := verifyExactTransaction(cloneTransactionForTest(t, valid), test.mutate(requirement))
			if err == nil || !strings.Contains(err.Error(), test.want) {
				t.Fatalf("expected %q, got %v", test.want, err)
			}
		})
	}
}

func TestVerifyExactTransactionAllowsOptionalLighthouseBeforeMemo(t *testing.T) {
	client, err := solana.NewRandomPrivateKey()
	if err != nil {
		t.Fatal(err)
	}
	state := testServerState(t)
	state.memo = "unit-lighthouse"
	requirement := exactRequirement(state)
	tx := transactionForTest(t, requirement, client)

	tx.Message.Instructions = append(
		tx.Message.Instructions[:3],
		append(
			[]solana.CompiledInstruction{compiledInstructionForTest(t, tx, lighthouseProgram, nil)},
			tx.Message.Instructions[3:]...,
		)...,
	)

	if err := verifyExactTransaction(tx, requirement); err != nil {
		t.Fatalf("expected lighthouse before memo to be accepted, got %v", err)
	}
}

func TestVerifyExactTransactionAllowsValidDestinationATACreateInstruction(t *testing.T) {
	client, err := solana.NewRandomPrivateKey()
	if err != nil {
		t.Fatal(err)
	}
	state := testServerState(t)
	state.memo = "unit-create-ata"
	requirement := exactRequirement(state)
	tx := transactionForTest(t, requirement, client)
	transfer, err := parseTransferCheckedInstruction(tx, tx.Message.Instructions[2])
	if err != nil {
		t.Fatal(err)
	}
	payTo := solana.MustPublicKeyFromBase58(requirement.PayTo)

	tx.Message.Instructions = append(
		tx.Message.Instructions[:3],
		append(
			[]solana.CompiledInstruction{
				compiledInstructionWithAccountsForTest(t, tx, solana.SPLAssociatedTokenAccountProgramID, []solana.PublicKey{
					client.PublicKey(),
					transfer.destination,
					payTo,
					transfer.mint,
					solana.SystemProgramID,
					transfer.tokenProgram,
				}, []byte{1}),
			},
			tx.Message.Instructions[3:]...,
		)...,
	)

	if err := verifyExactTransaction(tx, requirement); err != nil {
		t.Fatalf("expected valid destination ATA create instruction to be accepted, got %v", err)
	}
}

func TestValidDestinationATACreateInstructionRejectsMalformedCreateInstructions(t *testing.T) {
	client, err := solana.NewRandomPrivateKey()
	if err != nil {
		t.Fatal(err)
	}
	state := testServerState(t)
	state.memo = "unit-create-ata-invalid"
	requirement := exactRequirement(state)
	tx := transactionForTest(t, requirement, client)
	transfer, err := parseTransferCheckedInstruction(tx, tx.Message.Instructions[2])
	if err != nil {
		t.Fatal(err)
	}
	payTo := solana.MustPublicKeyFromBase58(requirement.PayTo)
	validAccounts := []solana.PublicKey{
		client.PublicKey(),
		transfer.destination,
		payTo,
		transfer.mint,
		solana.SystemProgramID,
		transfer.tokenProgram,
	}

	tests := map[string]solana.CompiledInstruction{
		"bad data":            compiledInstructionWithAccountsForTest(t, tx, solana.SPLAssociatedTokenAccountProgramID, validAccounts, []byte{2}),
		"too many data bytes": compiledInstructionWithAccountsForTest(t, tx, solana.SPLAssociatedTokenAccountProgramID, validAccounts, []byte{0, 0}),
		"too few accounts":    compiledInstructionWithAccountsForTest(t, tx, solana.SPLAssociatedTokenAccountProgramID, validAccounts[:5], nil),
		"wrong associated account": compiledInstructionWithAccountsForTest(t, tx, solana.SPLAssociatedTokenAccountProgramID, []solana.PublicKey{
			client.PublicKey(),
			solana.NewWallet().PublicKey(),
			payTo,
			transfer.mint,
			solana.SystemProgramID,
			transfer.tokenProgram,
		}, nil),
		"wrong wallet": compiledInstructionWithAccountsForTest(t, tx, solana.SPLAssociatedTokenAccountProgramID, []solana.PublicKey{
			client.PublicKey(),
			transfer.destination,
			solana.NewWallet().PublicKey(),
			transfer.mint,
			solana.SystemProgramID,
			transfer.tokenProgram,
		}, nil),
		"wrong mint": compiledInstructionWithAccountsForTest(t, tx, solana.SPLAssociatedTokenAccountProgramID, []solana.PublicKey{
			client.PublicKey(),
			transfer.destination,
			payTo,
			solana.NewWallet().PublicKey(),
			solana.SystemProgramID,
			transfer.tokenProgram,
		}, nil),
		"wrong system program": compiledInstructionWithAccountsForTest(t, tx, solana.SPLAssociatedTokenAccountProgramID, []solana.PublicKey{
			client.PublicKey(),
			transfer.destination,
			payTo,
			transfer.mint,
			solana.NewWallet().PublicKey(),
			transfer.tokenProgram,
		}, nil),
		"wrong token program": compiledInstructionWithAccountsForTest(t, tx, solana.SPLAssociatedTokenAccountProgramID, []solana.PublicKey{
			client.PublicKey(),
			transfer.destination,
			payTo,
			transfer.mint,
			solana.SystemProgramID,
			solana.NewWallet().PublicKey(),
		}, nil),
	}

	for name, instruction := range tests {
		t.Run(name, func(t *testing.T) {
			if validDestinationATACreateInstruction(tx, instruction, requirement, transfer) {
				t.Fatal("expected malformed destination ATA create instruction to be rejected")
			}
		})
	}
}

func TestVerifyTokenAccountsExistSkipsMissingDestinationWhenCreateATAIsPresent(t *testing.T) {
	client, err := solana.NewRandomPrivateKey()
	if err != nil {
		t.Fatal(err)
	}
	state := testServerState(t)
	state.memo = "unit-create-ata-exists"
	accountInfoCalls := 0
	state.httpClient = &http.Client{
		Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
			rawBody, err := io.ReadAll(request.Body)
			if err != nil {
				t.Fatal(err)
			}
			if !strings.Contains(string(rawBody), `"method":"getAccountInfo"`) {
				t.Fatalf("unexpected RPC body: %s", string(rawBody))
			}
			accountInfoCalls++
			return &http.Response{
				StatusCode: http.StatusOK,
				Header:     http.Header{"content-type": []string{"application/json"}},
				Body:       io.NopCloser(strings.NewReader(`{"jsonrpc":"2.0","id":1,"result":{"context":{"slot":1},"value":{"data":["","base64"]}}}`)),
			}, nil
		}),
	}
	requirement := exactRequirement(state)
	tx := transactionForTest(t, requirement, client)
	transfer, err := parseTransferCheckedInstruction(tx, tx.Message.Instructions[2])
	if err != nil {
		t.Fatal(err)
	}
	payTo := solana.MustPublicKeyFromBase58(requirement.PayTo)
	tx.Message.Instructions = append(
		tx.Message.Instructions[:3],
		append(
			[]solana.CompiledInstruction{
				compiledInstructionWithAccountsForTest(t, tx, solana.SPLAssociatedTokenAccountProgramID, []solana.PublicKey{
					client.PublicKey(),
					transfer.destination,
					payTo,
					transfer.mint,
					solana.SystemProgramID,
					transfer.tokenProgram,
				}, nil),
			},
			tx.Message.Instructions[3:]...,
		)...,
	)

	if err := verifyTokenAccountsExist(state, tx, requirement); err != nil {
		t.Fatalf("expected create ATA instruction to satisfy destination existence policy, got %v", err)
	}
	if accountInfoCalls != 1 {
		t.Fatalf("expected only source account lookup, got %d", accountInfoCalls)
	}
}

func TestVerifyTokenAccountsExistRejectsMissingDestinationWithoutCreateATA(t *testing.T) {
	client, err := solana.NewRandomPrivateKey()
	if err != nil {
		t.Fatal(err)
	}
	state := testServerState(t)
	state.memo = "unit-missing-destination"
	accountInfoCalls := 0
	state.httpClient = &http.Client{
		Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
			if _, err := io.ReadAll(request.Body); err != nil {
				t.Fatal(err)
			}
			accountInfoCalls++
			body := `{"jsonrpc":"2.0","id":1,"result":{"value":{"data":["","base64"]}}}`
			if accountInfoCalls == 2 {
				body = `{"jsonrpc":"2.0","id":1,"result":{"value":null}}`
			}
			return &http.Response{
				StatusCode: http.StatusOK,
				Header:     http.Header{"content-type": []string{"application/json"}},
				Body:       io.NopCloser(strings.NewReader(body)),
			}, nil
		}),
	}
	requirement := exactRequirement(state)
	tx := transactionForTest(t, requirement, client)

	if err := verifyTokenAccountsExist(state, tx, requirement); err == nil || err.Error() != "destination token account does not exist" {
		t.Fatalf("expected missing destination account, got %v", err)
	}
	if accountInfoCalls != 2 {
		t.Fatalf("expected source and destination lookups, got %d", accountInfoCalls)
	}
}

func TestVerifyTokenAccountsExistAcceptsExistingSourceAndDestination(t *testing.T) {
	client, err := solana.NewRandomPrivateKey()
	if err != nil {
		t.Fatal(err)
	}
	state := testServerState(t)
	state.memo = "unit-existing-atas"
	accountInfoCalls := 0
	state.httpClient = &http.Client{
		Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
			rawBody, err := io.ReadAll(request.Body)
			if err != nil {
				t.Fatal(err)
			}
			if !strings.Contains(string(rawBody), `"method":"getAccountInfo"`) {
				t.Fatalf("unexpected RPC body: %s", string(rawBody))
			}
			accountInfoCalls++
			return &http.Response{
				StatusCode: http.StatusOK,
				Header:     http.Header{"content-type": []string{"application/json"}},
				Body:       io.NopCloser(strings.NewReader(`{"jsonrpc":"2.0","id":1,"result":{"value":{"data":["","base64"]}}}`)),
			}, nil
		}),
	}
	requirement := exactRequirement(state)
	tx := transactionForTest(t, requirement, client)

	if err := verifyTokenAccountsExist(state, tx, requirement); err != nil {
		t.Fatalf("expected existing source and destination accounts, got %v", err)
	}
	if accountInfoCalls != 2 {
		t.Fatalf("expected source and destination lookups, got %d", accountInfoCalls)
	}
}

func TestVerifyExactTransactionAllowsMissingMemoWhenRequirementDoesNotBindMemo(t *testing.T) {
	client, err := solana.NewRandomPrivateKey()
	if err != nil {
		t.Fatal(err)
	}
	state := testServerState(t)
	state.memo = ""
	requirement := exactRequirement(state)
	builderRequirement := requirement
	builderRequirement.Extra = cloneExtra(requirement.Extra)
	builderRequirement.Extra["memo"] = "builder-memo"
	tx := transactionForTest(t, builderRequirement, client)
	tx.Message.Instructions = tx.Message.Instructions[:3]

	if err := verifyExactTransaction(tx, requirement); err != nil {
		t.Fatalf("expected missing memo to be accepted when requirement has no memo, got %v", err)
	}
}

func TestVerifyOptionalInstructionsRejectsMemoViolations(t *testing.T) {
	client, err := solana.NewRandomPrivateKey()
	if err != nil {
		t.Fatal(err)
	}
	state := testServerState(t)
	state.memo = "unit-memo"
	requirement := exactRequirement(state)
	tx := transactionForTest(t, requirement, client)
	transfer, err := parseTransferCheckedInstruction(tx, tx.Message.Instructions[2])
	if err != nil {
		t.Fatal(err)
	}

	tests := map[string]struct {
		requirement  paymentRequirement
		instructions []solana.CompiledInstruction
		want         string
	}{
		"empty unbound memo": {
			requirement: func() paymentRequirement {
				value := requirement
				value.Extra = cloneExtra(value.Extra)
				delete(value.Extra, "memo")
				return value
			}(),
			instructions: []solana.CompiledInstruction{compiledInstructionForTest(t, tx, memoProgramID.String(), nil)},
			want:         "invalid_exact_svm_payload_transaction_memo",
		},
		"oversized memo": {
			requirement: func() paymentRequirement {
				value := requirement
				value.Extra = cloneExtra(value.Extra)
				delete(value.Extra, "memo")
				return value
			}(),
			instructions: []solana.CompiledInstruction{compiledInstructionForTest(t, tx, memoProgramID.String(), []byte(strings.Repeat("x", maxMemoBytes+1)))},
			want:         "extra.memo exceeds maximum 256 bytes",
		},
		"duplicate bound memo": {
			requirement: requirement,
			instructions: []solana.CompiledInstruction{
				compiledInstructionForTest(t, tx, memoProgramID.String(), []byte("unit-memo")),
				compiledInstructionForTest(t, tx, memoProgramID.String(), []byte("unit-memo")),
			},
			want: "invalid_exact_svm_payload_transaction_memo",
		},
	}

	for name, test := range tests {
		t.Run(name, func(t *testing.T) {
			if err := verifyOptionalInstructions(tx, test.instructions, test.requirement, transfer); err == nil || err.Error() != test.want {
				t.Fatalf("expected %q, got %v", test.want, err)
			}
		})
	}
}

func TestDuplicateSettlementCachePrunesExpiredEntries(t *testing.T) {
	cache := newDuplicateSettlementCache()
	now := time.Unix(1_700_000_000, 0)
	cache.now = func() time.Time {
		return now
	}
	cache.entries["expired"] = now.Add(-(duplicateCacheTTL + time.Second))
	cache.entries["fresh"] = now

	if !cache.claim("new") {
		t.Fatal("expected new key to be claimed")
	}
	if _, ok := cache.entries["expired"]; ok {
		t.Fatal("expected expired cache entry to be pruned")
	}
	if _, ok := cache.entries["fresh"]; !ok {
		t.Fatal("expected fresh cache entry to survive pruning")
	}
	if !cache.claim("expired") {
		t.Fatal("expected pruned key to be claimable")
	}
	if cache.claim("fresh") {
		t.Fatal("expected fresh duplicate to be rejected")
	}
}

func TestAccountExistsHandlesRPCResponses(t *testing.T) {
	account := solana.NewWallet().PublicKey()
	tests := map[string]struct {
		status int
		body   string
		exists bool
		err    bool
	}{
		"exists": {
			status: http.StatusOK,
			body:   `{"jsonrpc":"2.0","id":1,"result":{"value":{"data":["","base64"]}}}`,
			exists: true,
		},
		"missing null value": {
			status: http.StatusOK,
			body:   `{"jsonrpc":"2.0","id":1,"result":{"value":null}}`,
			exists: false,
		},
		"missing result": {
			status: http.StatusOK,
			body:   `{"jsonrpc":"2.0","id":1}`,
			exists: false,
		},
		"rpc error": {
			status: http.StatusOK,
			body:   `{"jsonrpc":"2.0","id":1,"error":{"message":"nope"}}`,
			err:    true,
		},
		"http error": {
			status: http.StatusBadGateway,
			body:   `bad gateway`,
			err:    true,
		},
		"invalid json": {
			status: http.StatusOK,
			body:   `{`,
			err:    true,
		},
	}

	for name, test := range tests {
		t.Run(name, func(t *testing.T) {
			state := testServerState(t)
			state.httpClient = &http.Client{
				Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
					rawBody, err := io.ReadAll(request.Body)
					if err != nil {
						t.Fatal(err)
					}
					if !strings.Contains(string(rawBody), `"method":"getAccountInfo"`) || !strings.Contains(string(rawBody), account.String()) {
						t.Fatalf("unexpected accountExists RPC body: %s", string(rawBody))
					}
					return &http.Response{
						StatusCode: test.status,
						Header:     http.Header{"content-type": []string{"application/json"}},
						Body:       io.NopCloser(strings.NewReader(test.body)),
					}, nil
				}),
			}

			exists, err := accountExists(state, account)
			if test.err {
				if err == nil {
					t.Fatal("expected error")
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if exists != test.exists {
				t.Fatalf("exists = %v, want %v", exists, test.exists)
			}
		})
	}
}

func TestAccountExistsReturnsTransportErrors(t *testing.T) {
	state := testServerState(t)
	state.httpClient = &http.Client{
		Transport: roundTripFunc(func(_ *http.Request) (*http.Response, error) {
			return nil, errors.New("rpc unavailable")
		}),
	}

	if _, err := accountExists(state, solana.NewWallet().PublicKey()); err == nil {
		t.Fatal("expected transport error")
	}
}

func TestSendTransactionHandlesRPCResponses(t *testing.T) {
	baseState := testServerState(t)
	baseState.memo = "unit-send"
	tx := transactionForTest(t, exactRequirement(baseState), solana.NewWallet().PrivateKey)
	tests := map[string]struct {
		status int
		body   string
		want   string
		err    bool
	}{
		"success": {
			status: http.StatusOK,
			body:   `{"jsonrpc":"2.0","id":1,"result":"unit-signature"}`,
			want:   "unit-signature",
		},
		"http error": {
			status: http.StatusBadGateway,
			body:   `bad gateway`,
			err:    true,
		},
		"invalid json": {
			status: http.StatusOK,
			body:   `{`,
			err:    true,
		},
		"rpc error": {
			status: http.StatusOK,
			body:   `{"jsonrpc":"2.0","id":1,"error":{"message":"nope"}}`,
			err:    true,
		},
		"empty signature": {
			status: http.StatusOK,
			body:   `{"jsonrpc":"2.0","id":1,"result":""}`,
			err:    true,
		},
	}

	for name, test := range tests {
		t.Run(name, func(t *testing.T) {
			state := testServerState(t)
			state.httpClient = &http.Client{
				Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
					rawBody, err := io.ReadAll(request.Body)
					if err != nil {
						t.Fatal(err)
					}
					if !strings.Contains(string(rawBody), `"method":"sendTransaction"`) || !strings.Contains(string(rawBody), `"maxRetries":3`) {
						t.Fatalf("unexpected sendTransaction RPC body: %s", string(rawBody))
					}
					return &http.Response{
						StatusCode: test.status,
						Header:     http.Header{"content-type": []string{"application/json"}},
						Body:       io.NopCloser(strings.NewReader(test.body)),
					}, nil
				}),
			}

			got, err := sendTransaction(state, tx)
			if test.err {
				if err == nil {
					t.Fatal("expected error")
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if got != test.want {
				t.Fatalf("sendTransaction = %q, want %q", got, test.want)
			}
		})
	}
}

func TestSendTransactionReturnsTransportErrors(t *testing.T) {
	state := testServerState(t)
	state.memo = "unit-send-transport"
	tx := transactionForTest(t, exactRequirement(state), solana.NewWallet().PrivateKey)
	state.httpClient = &http.Client{
		Transport: roundTripFunc(func(_ *http.Request) (*http.Response, error) {
			return nil, errors.New("rpc unavailable")
		}),
	}

	if _, err := sendTransaction(state, tx); err == nil {
		t.Fatal("expected transport error")
	}
}

func TestAccountAtRejectsInvalidIndexes(t *testing.T) {
	state := testServerState(t)
	state.memo = "unit-index"
	tx := transactionForTest(t, exactRequirement(state), solana.NewWallet().PrivateKey)
	if _, err := accountAt(tx, uint16(len(tx.Message.AccountKeys))); err == nil {
		t.Fatal("expected invalid account index")
	}
	if _, err := programID(tx, solana.CompiledInstruction{ProgramIDIndex: uint16(len(tx.Message.AccountKeys))}); err == nil {
		t.Fatal("expected invalid program index")
	}
}

func TestInteropMuxRoutesHealthCapabilitiesAndChallenges(t *testing.T) {
	state := testServerState(t)
	mux := newInteropMux(state)

	tests := map[string]struct {
		path       string
		status     int
		header     string
		bodySearch string
	}{
		"health": {
			path:       "/health",
			status:     http.StatusOK,
			bodySearch: `"ok":true`,
		},
		"capabilities": {
			path:       "/capabilities",
			status:     http.StatusOK,
			bodySearch: `"implementation":"go"`,
		},
		"exact challenge": {
			path:       "/exact",
			status:     http.StatusPaymentRequired,
			header:     "PAYMENT-REQUIRED",
			bodySearch: `"payment_required"`,
		},
		"upto challenge": {
			path:       "/upto",
			status:     http.StatusPaymentRequired,
			header:     "PAYMENT-REQUIRED",
			bodySearch: `"payment_required"`,
		},
		"session challenge": {
			path:       "/session",
			status:     http.StatusPaymentRequired,
			bodySearch: `"intent":"session"`,
		},
		"batch settlement challenge": {
			path:       "/batch-settlement",
			status:     http.StatusPaymentRequired,
			header:     "PAYMENT-REQUIRED",
			bodySearch: `"payment_required"`,
		},
		"protected challenge": {
			path:       defaultResourcePath,
			status:     http.StatusPaymentRequired,
			header:     "PAYMENT-REQUIRED",
			bodySearch: `"payment_required"`,
		},
		"not found": {
			path:       "/missing",
			status:     http.StatusNotFound,
			bodySearch: `"not_found"`,
		},
	}

	for name, test := range tests {
		t.Run(name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodGet, test.path, nil)
			recorder := httptest.NewRecorder()

			mux.ServeHTTP(recorder, request)

			if recorder.Code != test.status {
				t.Fatalf("status = %d, want %d; body=%s", recorder.Code, test.status, recorder.Body.String())
			}
			if test.header != "" && recorder.Header().Get(test.header) == "" {
				t.Fatalf("expected %s header", test.header)
			}
			if test.bodySearch != "" && !strings.Contains(recorder.Body.String(), test.bodySearch) {
				t.Fatalf("body %s does not contain %s", recorder.Body.String(), test.bodySearch)
			}
		})
	}
}

func TestInteropMuxProtectedRouteRejectsInvalidPayment(t *testing.T) {
	state := testServerState(t)
	mux := newInteropMux(state)
	request := httptest.NewRequest(http.MethodGet, defaultResourcePath, nil)
	request.Header.Set("PAYMENT-SIGNATURE", "not base64")
	recorder := httptest.NewRecorder()

	mux.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusPaymentRequired {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusPaymentRequired)
	}
	if recorder.Header().Get("PAYMENT-REQUIRED") == "" {
		t.Fatal("expected refreshed payment challenge")
	}
	if !strings.Contains(recorder.Body.String(), `"payment_invalid"`) {
		t.Fatalf("expected payment_invalid body, got %s", recorder.Body.String())
	}
}

func TestInteropMuxProtectedRouteSettlesValidPayment(t *testing.T) {
	settlementCache = newDuplicateSettlementCache()
	defer func() {
		settlementCache = newDuplicateSettlementCache()
	}()
	client, err := solana.NewRandomPrivateKey()
	if err != nil {
		t.Fatal(err)
	}
	state := testServerState(t)
	state.memo = "unit-mux-settle"
	state.httpClient = &http.Client{
		Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
			rawBody, err := io.ReadAll(request.Body)
			if err != nil {
				t.Fatal(err)
			}
			body := string(rawBody)
			responseBody := `{"jsonrpc":"2.0","id":1,"result":{"value":{"data":["","base64"]}}}`
			if strings.Contains(body, `"method":"sendTransaction"`) {
				responseBody = `{"jsonrpc":"2.0","id":1,"result":"unit-mux-settlement"}`
			}
			return &http.Response{
				StatusCode: http.StatusOK,
				Header:     http.Header{"content-type": []string{"application/json"}},
				Body:       io.NopCloser(strings.NewReader(responseBody)),
			}, nil
		}),
	}
	requirement := exactRequirement(state)
	header := encodePaymentSignatureForTest(t, paymentSignatureEnvelope{
		X402Version: 2,
		Accepted:    requirement,
		Payload: map[string]string{
			"transaction": signedTransactionForTest(t, requirement, client),
		},
	})
	mux := newInteropMux(state)
	request := httptest.NewRequest(http.MethodGet, defaultResourcePath, nil)
	request.Header.Set("PAYMENT-SIGNATURE", header)
	recorder := httptest.NewRecorder()

	mux.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body=%s", recorder.Code, http.StatusOK, recorder.Body.String())
	}
	if recorder.Header().Get(defaultSettlementHeader) != "unit-mux-settlement" {
		t.Fatalf("settlement header = %q", recorder.Header().Get(defaultSettlementHeader))
	}
	if !strings.Contains(recorder.Body.String(), `"paid":true`) {
		t.Fatalf("expected paid response, got %s", recorder.Body.String())
	}
}

func TestRunInteropServerEmitsReadyAndStopsOnSignal(t *testing.T) {
	state := testServerState(t)
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	signals := make(chan os.Signal, 1)
	var ready bytes.Buffer
	var errors bytes.Buffer
	done := make(chan error, 1)

	go func() {
		done <- runInteropServer(state, listener, signals, &ready, &errors)
	}()

	baseURL := "http://" + listener.Addr().String()
	deadline := time.Now().Add(2 * time.Second)
	for {
		response, err := http.Get(baseURL + "/health")
		if err == nil {
			_ = response.Body.Close()
			if response.StatusCode == http.StatusOK {
				break
			}
		}
		if time.Now().After(deadline) {
			t.Fatalf("server did not become ready; ready=%s errors=%s lastErr=%v", ready.String(), errors.String(), err)
		}
		time.Sleep(10 * time.Millisecond)
	}

	var payload map[string]any
	if err := json.Unmarshal(bytes.TrimSpace(ready.Bytes()), &payload); err != nil {
		t.Fatalf("decode ready payload %q: %v", ready.String(), err)
	}
	if payload["type"] != "ready" || payload["implementation"] != "go" {
		t.Fatalf("unexpected ready payload: %#v", payload)
	}
	if _, ok := payload["port"].(float64); !ok {
		t.Fatalf("ready payload missing port: %#v", payload)
	}

	signals <- syscall.SIGTERM
	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("runInteropServer returned %v; errors=%s", err, errors.String())
		}
	case <-time.After(2 * time.Second):
		t.Fatal("server did not stop after signal")
	}
}

func TestRunInteropServerReturnsServeErrors(t *testing.T) {
	state := testServerState(t)
	signals := make(chan os.Signal)
	var ready bytes.Buffer
	var errors bytes.Buffer

	err := runInteropServer(state, failingListener{}, signals, &ready, &errors)

	if err == nil || !strings.Contains(err.Error(), "listener failed") {
		t.Fatalf("expected listener failure, got %v", err)
	}
	if ready.String() == "" {
		t.Fatal("expected ready payload before listener failure")
	}
	if !strings.Contains(errors.String(), "listener failed") {
		t.Fatalf("expected error writer to receive listener failure, got %q", errors.String())
	}
}

func TestMainPanicsWhenRequiredEnvMissing(t *testing.T) {
	mustPanic(t, main)
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return fn(request)
}

type failingListener struct{}

func (failingListener) Accept() (net.Conn, error) {
	return nil, errors.New("listener failed")
}

func (failingListener) Close() error {
	return nil
}

func (failingListener) Addr() net.Addr {
	return &net.TCPAddr{IP: net.ParseIP("127.0.0.1"), Port: 0}
}

func cloneExtra(extra map[string]any) map[string]any {
	cloned := make(map[string]any, len(extra))
	for key, value := range extra {
		cloned[key] = value
	}
	return cloned
}

func testServerState(t *testing.T) serverState {
	t.Helper()
	feePayer, err := solana.NewRandomPrivateKey()
	if err != nil {
		t.Fatal(err)
	}
	return serverState{
		rpcURL:     "http://127.0.0.1:8899",
		network:    "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
		mint:       "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
		payTo:      solana.NewWallet().PublicKey().String(),
		feePayer:   feePayer,
		amount:     "1000",
		httpClient: &http.Client{},
	}
}

func encodePaymentSignatureForTest(t *testing.T, envelope paymentSignatureEnvelope) string {
	t.Helper()
	encoded, err := json.Marshal(envelope)
	if err != nil {
		t.Fatal(err)
	}
	return base64.StdEncoding.EncodeToString(encoded)
}

func signedTransactionForTest(t *testing.T, requirement paymentRequirement, client solana.PrivateKey) string {
	t.Helper()
	tx := transactionForTest(t, requirement, client)
	encoded, err := tx.ToBase64()
	if err != nil {
		t.Fatal(err)
	}
	return encoded
}

func transactionForTest(t *testing.T, requirement paymentRequirement, client solana.PrivateKey) *solana.Transaction {
	t.Helper()
	feePayer, err := solana.PublicKeyFromBase58(requirement.Extra["feePayer"].(string))
	if err != nil {
		t.Fatal(err)
	}
	mint, err := solana.PublicKeyFromBase58(requirement.Asset)
	if err != nil {
		t.Fatal(err)
	}
	payTo, err := solana.PublicKeyFromBase58(requirement.PayTo)
	if err != nil {
		t.Fatal(err)
	}
	tokenProgram, err := solana.PublicKeyFromBase58(requirement.Extra["tokenProgram"].(string))
	if err != nil {
		t.Fatal(err)
	}
	source, _, err := solana.FindAssociatedTokenAddressWithProgram(client.PublicKey(), mint, tokenProgram)
	if err != nil {
		t.Fatal(err)
	}
	destination, _, err := solana.FindAssociatedTokenAddressWithProgram(payTo, mint, tokenProgram)
	if err != nil {
		t.Fatal(err)
	}
	amount, err := strconv.ParseUint(requirement.Amount, 10, 64)
	if err != nil {
		t.Fatal(err)
	}
	transferData := []byte{12}
	transferData = binary.LittleEndian.AppendUint64(transferData, amount)
	transferData = append(transferData, byte(defaultDecimals))

	tx, err := solana.NewTransaction(
		[]solana.Instruction{
			computeLimitInstructionForTest(20_000),
			computePriceInstructionForTest(1),
			solana.NewInstruction(
				tokenProgram,
				solana.AccountMetaSlice{
					solana.Meta(source).WRITE(),
					solana.Meta(mint),
					solana.Meta(destination).WRITE(),
					solana.Meta(client.PublicKey()).SIGNER(),
				},
				transferData,
			),
			solana.NewInstruction(memoProgramID, nil, []byte(requirement.Extra["memo"].(string))),
		},
		solana.Hash{},
		solana.TransactionPayer(feePayer),
	)
	if err != nil {
		t.Fatal(err)
	}
	tx.Message.SetVersion(solana.MessageVersionV0)
	if _, err := tx.PartialSign(func(key solana.PublicKey) *solana.PrivateKey {
		if key.Equals(client.PublicKey()) {
			return &client
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	return tx
}

func cloneTransactionForTest(t *testing.T, tx *solana.Transaction) *solana.Transaction {
	t.Helper()
	encoded, err := tx.ToBase64()
	if err != nil {
		t.Fatal(err)
	}
	cloned, err := solana.TransactionFromBase64(encoded)
	if err != nil {
		t.Fatal(err)
	}
	return cloned
}

func computeLimitInstructionForTest(units uint32) solana.Instruction {
	data := []byte{2}
	data = binary.LittleEndian.AppendUint32(data, units)
	return solana.NewInstruction(computeBudgetProgramID, nil, data)
}

func computePriceInstructionForTest(microLamports uint64) solana.Instruction {
	return solana.NewInstruction(computeBudgetProgramID, nil, computePriceDataForTest(microLamports))
}

func computePriceDataForTest(microLamports uint64) []byte {
	data := []byte{3}
	return binary.LittleEndian.AppendUint64(data, microLamports)
}

func compiledInstructionForTest(t *testing.T, tx *solana.Transaction, program string, data []byte) solana.CompiledInstruction {
	t.Helper()
	programKey := solana.MustPublicKeyFromBase58(program)
	return compiledInstructionWithAccountsForTest(t, tx, programKey, nil, data)
}

func compiledInstructionWithAccountsForTest(t *testing.T, tx *solana.Transaction, programKey solana.PublicKey, accounts []solana.PublicKey, data []byte) solana.CompiledInstruction {
	t.Helper()
	programIndex := -1
	for index, key := range tx.Message.AccountKeys {
		if key.Equals(programKey) {
			programIndex = index
			break
		}
	}
	if programIndex == -1 {
		tx.Message.AccountKeys = append(tx.Message.AccountKeys, programKey)
		programIndex = len(tx.Message.AccountKeys) - 1
	}
	accountIndexes := make([]uint16, 0, len(accounts))
	for _, account := range accounts {
		accountIndex := -1
		for index, key := range tx.Message.AccountKeys {
			if key.Equals(account) {
				accountIndex = index
				break
			}
		}
		if accountIndex == -1 {
			tx.Message.AccountKeys = append(tx.Message.AccountKeys, account)
			accountIndex = len(tx.Message.AccountKeys) - 1
		}
		accountIndexes = append(accountIndexes, uint16(accountIndex))
	}
	return solana.CompiledInstruction{
		ProgramIDIndex: uint16(programIndex),
		Accounts:       accountIndexes,
		Data:           data,
	}
}

func mustPanic(t *testing.T, fn func()) {
	t.Helper()
	defer func() {
		if recovered := recover(); recovered == nil {
			t.Fatal("expected panic")
		}
	}()
	fn()
}
