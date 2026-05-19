<?php

declare(strict_types=1);

$server = stream_socket_server('tcp://127.0.0.1:0', $errno, $errstr);
if ($server === false) {
    fwrite(STDERR, "failed to bind PHP interop server: {$errstr}\n");
    exit(1);
}

$address = stream_socket_get_name($server, false);
if ($address === false) {
    fwrite(STDERR, "failed to read PHP interop server address\n");
    exit(1);
}

$port = (int) substr(strrchr($address, ':'), 1);
echo json_encode([
    'type' => 'ready',
    'implementation' => 'php',
    'role' => 'server',
    'port' => $port,
    'capabilities' => ['exact'],
], JSON_THROW_ON_ERROR) . PHP_EOL;

$running = true;
if (function_exists('pcntl_signal')) {
    pcntl_signal(SIGTERM, static function () use (&$running): void {
        $running = false;
    });
    pcntl_signal(SIGINT, static function () use (&$running): void {
        $running = false;
    });
}

while ($running) {
    if (function_exists('pcntl_signal_dispatch')) {
        pcntl_signal_dispatch();
    }

    $connection = @stream_socket_accept($server, 1);
    if ($connection === false) {
        continue;
    }

    $requestLine = fgets($connection) ?: '';
    $path = '/';
    if (preg_match('/^[A-Z]+\s+([^\s]+)\s+HTTP\/[0-9.]+$/', trim($requestLine), $matches) === 1) {
        $path = parse_url($matches[1], PHP_URL_PATH) ?: '/';
    }

    while (($line = fgets($connection)) !== false) {
        if (trim($line) === '') {
            break;
        }
    }

    $status = $path === '/health' ? 200 : 501;
    if ($path === '/health') {
        $body = ['ok' => true];
    } elseif ($path === '/upto') {
        $body = [
            'ok' => false,
            'paid' => false,
            'error' => 'php_upto_server_not_implemented',
        ];
    } elseif ($path === '/session') {
        $body = [
            'ok' => false,
            'paid' => false,
            'error' => 'php_session_server_not_implemented',
        ];
    } else {
        $body = [
            'ok' => false,
            'paid' => false,
            'error' => 'php_exact_server_not_implemented',
        ];
    }
    $encoded = json_encode($body, JSON_THROW_ON_ERROR);
    $reason = $status === 200 ? 'OK' : 'Not Implemented';

    fwrite(
        $connection,
        "HTTP/1.1 {$status} {$reason}\r\n" .
        "content-type: application/json\r\n" .
        'content-length: ' . strlen($encoded) . "\r\n" .
        "connection: close\r\n\r\n" .
        $encoded,
    );
    fclose($connection);
}

fclose($server);
