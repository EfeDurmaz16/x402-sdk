<?php

declare(strict_types=1);

function fail(string $message): never
{
    fwrite(STDERR, $message . PHP_EOL);
    exit(1);
}

function request_json(int $port, string $path): array
{
    $socket = @fsockopen('127.0.0.1', $port, $errno, $errstr, 5);
    if ($socket === false) {
        fail("failed to connect to PHP interop server: {$errstr}");
    }

    fwrite($socket, "GET {$path} HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n");
    $raw = stream_get_contents($socket);
    fclose($socket);

    if ($raw === false || !str_contains($raw, "\r\n\r\n")) {
        fail('invalid HTTP response from PHP interop server');
    }

    [$head, $body] = explode("\r\n\r\n", $raw, 2);
    $statusLine = strtok($head, "\r\n");
    if (!is_string($statusLine) || preg_match('/^HTTP\/[0-9.]+\s+([0-9]+)/', $statusLine, $matches) !== 1) {
        fail('missing HTTP status line from PHP interop server');
    }

    $decoded = json_decode($body, true, flags: JSON_THROW_ON_ERROR);
    if (!is_array($decoded)) {
        fail('PHP interop server did not return a JSON object');
    }

    return [
        'status' => (int) $matches[1],
        'body' => $decoded,
    ];
}

$descriptorSpec = [
    0 => ['pipe', 'r'],
    1 => ['pipe', 'w'],
    2 => ['pipe', 'w'],
];

$process = proc_open(['php', __DIR__ . '/../bin/interop-server.php'], $descriptorSpec, $pipes);
if (!is_resource($process)) {
    fail('failed to start PHP interop server');
}

try {
    fclose($pipes[0]);
    $readyLine = fgets($pipes[1]);
    if ($readyLine === false) {
        fail('PHP interop server did not print readiness');
    }

    $ready = json_decode($readyLine, true, flags: JSON_THROW_ON_ERROR);
    if (($ready['type'] ?? null) !== 'ready' || ($ready['implementation'] ?? null) !== 'php') {
        fail('unexpected PHP interop server readiness payload');
    }

    $port = $ready['port'] ?? null;
    if (!is_int($port) || $port <= 0) {
        fail('PHP interop server readiness is missing a valid port');
    }

    $health = request_json($port, '/health');
    if ($health !== ['status' => 200, 'body' => ['ok' => true]]) {
        fail('unexpected PHP interop server health response: ' . json_encode($health));
    }

    $protected = request_json($port, '/protected');
    if ($protected !== [
        'status' => 501,
        'body' => [
            'ok' => false,
            'paid' => false,
            'error' => 'php_exact_server_not_implemented',
        ],
    ]) {
        fail('unexpected PHP interop server protected response: ' . json_encode($protected));
    }
} finally {
    proc_terminate($process);
    proc_close($process);
}

echo "PHP interop server contract OK\n";
