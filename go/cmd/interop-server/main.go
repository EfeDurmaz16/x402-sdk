package main

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
)

func writeJSON(response http.ResponseWriter, status int, payload map[string]any) {
	response.Header().Set("content-type", "application/json")
	response.WriteHeader(status)
	if err := json.NewEncoder(response).Encode(payload); err != nil {
		fmt.Fprintln(os.Stderr, err)
	}
}

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(response http.ResponseWriter, _ *http.Request) {
		writeJSON(response, http.StatusOK, map[string]any{"ok": true})
	})
	mux.HandleFunc("/", func(response http.ResponseWriter, _ *http.Request) {
		writeJSON(response, http.StatusNotImplemented, map[string]any{
			"ok":    false,
			"paid":  false,
			"error": "go_exact_server_not_implemented",
		})
	})

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		panic(err)
	}

	server := &http.Server{Handler: mux}
	go func() {
		if err := server.Serve(listener); err != nil && err != http.ErrServerClosed {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
	}()

	ready := map[string]any{
		"type":           "ready",
		"implementation": "go",
		"role":           "server",
		"port":           listener.Addr().(*net.TCPAddr).Port,
		"capabilities":   []string{"exact"},
	}
	encoded, err := json.Marshal(ready)
	if err != nil {
		panic(err)
	}
	fmt.Println(string(encoded))

	signals := make(chan os.Signal, 1)
	signal.Notify(signals, syscall.SIGTERM, syscall.SIGINT)
	<-signals
	if err := server.Close(); err != nil {
		fmt.Fprintln(os.Stderr, err)
	}
}
