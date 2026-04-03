#!/bin/bash
set -euo pipefail

HOST=${HOST:-0.0.0.0}
PORT=${PORT:-8080}
BACKEND_HOST=${BACKEND_HOST:-127.0.0.1}
BACKEND_PORT=${BACKEND_PORT:-8081}
API_PREFIX=${API_PREFIX:-}
OSCAR_SERVICE_NAME=${OSCAR_SERVICE_NAME:-}
OSCAR_SERVICE_TOKEN=${OSCAR_SERVICE_TOKEN:-}
OSCAR_SERVICE_BASE_PATH=${OSCAR_SERVICE_BASE_PATH:-}
OSCAR_SERVICE_FDL_PATH=${OSCAR_SERVICE_FDL_PATH:-/oscar/config/function_config.yaml}
MODEL_PATH=${MODEL_PATH:-/models/qwen2.5-0.5b-instruct-q4_k_m.gguf}
MODEL_ALIAS=${MODEL_ALIAS:-Qwen2.5-0.5B-Instruct}
CONTEXT_SIZE=${CONTEXT_SIZE:-2048}
N_THREADS=${N_THREADS:-2}
N_PARALLEL=${N_PARALLEL:-1}
N_PREDICT=${N_PREDICT:-512}

read_fdl_value() {
  local fdl_path="$1"
  local key="$2"

  [[ -r "${fdl_path}" ]] || return 1

  awk -v key="${key}" '
    $0 ~ ("^" key ":[[:space:]]*") {
      sub("^" key ":[[:space:]]*", "")
      print
      exit
    }
  ' "${fdl_path}"
}

if [ -z "$API_PREFIX" ]; then
  if [ -n "$OSCAR_SERVICE_BASE_PATH" ]; then
    API_PREFIX="$OSCAR_SERVICE_BASE_PATH"
  elif [ -n "$OSCAR_SERVICE_NAME" ]; then
    API_PREFIX="/system/services/${OSCAR_SERVICE_NAME}/exposed"
  elif SERVICE_NAME="$(read_fdl_value "$OSCAR_SERVICE_FDL_PATH" name)"; then
    API_PREFIX="/system/services/${SERVICE_NAME}/exposed"
  fi
fi

if [ -z "${API_KEY:-}" ]; then
  if [ -n "$OSCAR_SERVICE_TOKEN" ]; then
    API_KEY="${OSCAR_SERVICE_TOKEN}"
  elif OSCAR_SERVICE_TOKEN="$(read_fdl_value "$OSCAR_SERVICE_FDL_PATH" token)"; then
    API_KEY="${OSCAR_SERVICE_TOKEN}"
  fi
fi

start_proxy() {
  local proxy_script=/tmp/llamacpp-proxy.pl

  cat >"$proxy_script" <<'EOF'
#!/usr/bin/perl
use strict;
use warnings;
use IO::Socket::INET;

$| = 1;

my $listen_host  = $ENV{PROXY_LISTEN_HOST} // '0.0.0.0';
my $listen_port  = $ENV{PROXY_LISTEN_PORT} // '8080';
my $backend_host = $ENV{PROXY_BACKEND_HOST} // '127.0.0.1';
my $backend_port = $ENV{PROXY_BACKEND_PORT} // '8081';
my $api_prefix   = $ENV{PROXY_API_PREFIX} // '';
my $api_key      = $ENV{PROXY_API_KEY} // '';
my $health_path  = $ENV{PROXY_HEALTH_PATH} // '/health';
my $login_path   = ($api_prefix || '') . '/__login';
my $cookie_name  = 'llama_auth';

sub send_health {
    my ($client) = @_;

    my $backend = IO::Socket::INET->new(
        PeerAddr => $backend_host,
        PeerPort => $backend_port,
        Proto    => 'tcp',
        Timeout  => 1,
    );

    if ($backend) {
        close $backend;
        my $body = "{\"status\":\"ok\"}\n";
        print {$client} "HTTP/1.1 200 OK\r\n";
        print {$client} "Content-Type: application/json\r\n";
        print {$client} "Content-Length: " . length($body) . "\r\n";
        print {$client} "Connection: close\r\n\r\n";
        print {$client} $body;
        return;
    }

    my $body = "{\"status\":\"unavailable\"}\n";
    print {$client} "HTTP/1.1 503 Service Unavailable\r\n";
    print {$client} "Content-Type: application/json\r\n";
    print {$client} "Content-Length: " . length($body) . "\r\n";
    print {$client} "Connection: close\r\n\r\n";
    print {$client} $body;
}

sub parse_cookies {
    my ($headers_ref) = @_;
    my %headers = %{$headers_ref};
    my $cookie_header = $headers{'Cookie'} // $headers{'cookie'} // '';
    my %cookies;

    for my $pair (split /;\s*/, $cookie_header) {
        next unless $pair =~ /=/;
        my ($name, $value) = split(/=/, $pair, 2);
        $cookies{$name} = $value if defined $name;
    }

    return %cookies;
}

sub url_decode {
    my ($value) = @_;
    $value //= '';
    $value =~ tr/+/ /;
    $value =~ s/%([0-9A-Fa-f]{2})/chr(hex($1))/eg;
    return $value;
}

sub url_encode {
    my ($value) = @_;
    $value //= '';
    $value =~ s/([^A-Za-z0-9\-._~\/])/sprintf("%%%02X", ord($1))/eg;
    return $value;
}

sub html_escape {
    my ($value) = @_;
    $value //= '';
    $value =~ s/&/&amp;/g;
    $value =~ s/</&lt;/g;
    $value =~ s/>/&gt;/g;
    $value =~ s/"/&quot;/g;
    return $value;
}

sub parse_query {
    my ($query) = @_;
    my %params;

    for my $pair (split /&/, ($query // '')) {
        next if $pair eq '';
        my ($name, $value) = split(/=/, $pair, 2);
        $params{url_decode($name)} = url_decode($value // '');
    }

    return %params;
}

sub has_valid_bearer {
    my ($headers_ref) = @_;
    my %headers = %{$headers_ref};

    for my $name (keys %headers) {
        next unless lc($name) eq 'authorization' || lc($name) eq 'x-api-key';
        if (lc($name) eq 'x-api-key') {
            return 1 if $headers{$name} eq $api_key;
            next;
        }
        return 1 if $headers{$name} eq "Bearer $api_key";
    }

    return 0;
}

sub has_valid_cookie {
    my ($headers_ref) = @_;
    my %cookies = parse_cookies($headers_ref);
    return (($cookies{$cookie_name} // '') eq $api_key) ? 1 : 0;
}

sub is_authorized {
    my ($headers_ref) = @_;
    return 1 if has_valid_bearer($headers_ref);
    return 1 if has_valid_cookie($headers_ref);
    return 0;
}

sub is_api_request {
    my ($path) = @_;
    return 1 if $path =~ m{^\Q$api_prefix\E/v1(?:/|$)};
    return 1 if $path =~ m{^\Q$api_prefix\E/(?:models|props|metrics|slots|completion|completions|responses|messages|embedding|embeddings|rerank|reranking|tokenize|detokenize|apply-template|lora-adapters)(?:/|$)};
    return 1 if $path =~ m{^\Q$api_prefix\E/api/(?:chat|show|tags)(?:/|$)};
    return 0;
}

sub send_login_page {
    my ($client, $next_path, $error) = @_;

    my $safe_next = $next_path && $next_path =~ m{^\Q$api_prefix\E(?:/|$)} ? $next_path : "$api_prefix/";
    my $error_block = $error ? '<p style="color:#b91c1c;margin:0 0 1rem 0;">Invalid token.</p>' : '';
    my $body = <<"HTML";
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>llama.cpp Login</title>
  <style>
    body { font-family: sans-serif; background: #f4f4f5; color: #111827; margin: 0; min-height: 100vh; display: grid; place-items: center; }
    main { width: min(28rem, calc(100vw - 2rem)); background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 1.5rem; box-shadow: 0 12px 32px rgba(0,0,0,0.08); }
    h1 { margin: 0 0 0.5rem 0; font-size: 1.25rem; }
    p { margin: 0 0 1rem 0; color: #4b5563; }
    label { display: block; margin-bottom: 0.5rem; font-weight: 600; }
    input { width: 100%; box-sizing: border-box; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 8px; font: inherit; }
    button { margin-top: 1rem; width: 100%; padding: 0.75rem; border: 0; border-radius: 8px; background: #111827; color: white; font: inherit; cursor: pointer; }
  </style>
</head>
<body>
  <main>
    <h1>Protected llama.cpp UI</h1>
    <p>Enter the OSCAR service token to access the Web UI.</p>
    $error_block
    <form method="post" action="$login_path">
      <input type="hidden" name="next" value="@{[ html_escape($safe_next) ]}">
      <label for="token">Service token</label>
      <input id="token" name="token" type="password" autocomplete="current-password" required>
      <button type="submit">Continue</button>
    </form>
  </main>
</body>
</html>
HTML

    print {$client} "HTTP/1.1 200 OK\r\n";
    print {$client} "Content-Type: text/html; charset=utf-8\r\n";
    print {$client} "Content-Length: " . length($body) . "\r\n";
    print {$client} "Connection: close\r\n\r\n";
    print {$client} $body;
}

sub send_redirect_to_login {
    my ($client, $path) = @_;
    my $location = $login_path . '?next=' . url_encode($path);
    print {$client} "HTTP/1.1 302 Found\r\n";
    print {$client} "Location: $location\r\n";
    print {$client} "Content-Length: 0\r\n";
    print {$client} "Connection: close\r\n\r\n";
}

sub handle_login {
    my ($client, $method, $path, $body_ref) = @_;
    my ($login_uri, $query) = split(/\?/, $path, 2);
    my %query_params = parse_query($query);

    if ($method eq 'GET') {
        send_login_page($client, $query_params{next}, 0);
        return;
    }

    if ($method eq 'POST') {
        my %form = parse_query(${$body_ref});
        my $token = $form{token} // '';
        my $next_path = $form{next} // "$api_prefix/";
        if ($token eq $api_key) {
            my $safe_next = $next_path =~ m{^\Q$api_prefix\E(?:/|$)} ? $next_path : "$api_prefix/";
            print {$client} "HTTP/1.1 302 Found\r\n";
            print {$client} "Location: $safe_next\r\n";
            print {$client} "Set-Cookie: $cookie_name=$api_key; Path=$api_prefix/; HttpOnly; SameSite=Lax\r\n";
            print {$client} "Content-Length: 0\r\n";
            print {$client} "Connection: close\r\n\r\n";
            return;
        }

        send_login_page($client, $next_path, 1);
        return;
    }

    print {$client} "HTTP/1.1 405 Method Not Allowed\r\n";
    print {$client} "Content-Length: 0\r\n";
    print {$client} "Connection: close\r\n\r\n";
}

sub send_unauthorized {
    my ($client) = @_;
    my $body = "{\"error\":\"Unauthorized\"}\n";
    print {$client} "HTTP/1.1 401 Unauthorized\r\n";
    print {$client} "Content-Type: application/json\r\n";
    print {$client} "Content-Length: " . length($body) . "\r\n";
    print {$client} "Connection: close\r\n\r\n";
    print {$client} $body;
}

sub proxy_request {
    my ($request_line, $headers_ref, $body_ref) = @_;

    my %headers = %{$headers_ref};
    $headers{'Host'} = "$backend_host:$backend_port";
    $headers{'Connection'} = 'close';
    delete $headers{'Cookie'};
    delete $headers{'cookie'};
    $headers{'Authorization'} = "Bearer $api_key";

    my $backend = IO::Socket::INET->new(
        PeerAddr => $backend_host,
        PeerPort => $backend_port,
        Proto    => 'tcp',
        Timeout  => 30,
    ) or return undef;

    print {$backend} $request_line;
    for my $name (keys %headers) {
        print {$backend} "$name: $headers{$name}\r\n";
    }
    print {$backend} "\r\n";
    print {$backend} ${$body_ref} if defined($body_ref) && length(${$body_ref});

    return $backend;
}

my $server = IO::Socket::INET->new(
    LocalAddr => $listen_host,
    LocalPort => $listen_port,
    Proto     => 'tcp',
    Listen    => 16,
    ReuseAddr => 1,
) or die "cannot listen on $listen_host:$listen_port: $!";

while (my $client = $server->accept()) {
    eval {
        my $request_line = <$client>;
        if (!defined $request_line) {
            close $client;
            next;
        }

        my ($method, $path) = $request_line =~ m{^([A-Z]+)\s+(\S+)\s+HTTP/};
        if (!$method || !$path) {
            close $client;
            next;
        }
        my ($uri_path) = split(/\?/, $path, 2);

        my %headers;
        while (my $line = <$client>) {
            $line =~ s/\r?\n$//;
            last if $line eq '';
            my ($name, $value) = split(/:\s*/, $line, 2);
            $headers{$name} = defined($value) ? $value : '';
        }

        my $content_length = $headers{'Content-Length'} // $headers{'content-length'} // 0;
        my $body = '';
        if ($content_length =~ /^\d+$/ && $content_length > 0) {
            my $read = read($client, $body, $content_length);
            die "short read from client" if !defined($read) || $read != $content_length;
        }

        if ($uri_path eq $health_path || $uri_path eq ($api_prefix . $health_path)) {
            send_health($client);
            close $client;
            next;
        }

        if ($uri_path eq $login_path) {
            handle_login($client, $method, $path, \$body);
            close $client;
            next;
        }

        if (!is_authorized(\%headers)) {
            if ($method =~ /^(GET|HEAD)$/ && !is_api_request($uri_path)) {
                send_redirect_to_login($client, $path);
            } else {
                send_unauthorized($client);
            }
            close $client;
            next;
        }

        my $backend = proxy_request($request_line, \%headers, \$body);
        if (!$backend) {
            my $body = "{\"error\":\"Bad Gateway\"}\n";
            print {$client} "HTTP/1.1 502 Bad Gateway\r\n";
            print {$client} "Content-Type: application/json\r\n";
            print {$client} "Content-Length: " . length($body) . "\r\n";
            print {$client} "Connection: close\r\n\r\n";
            print {$client} $body;
            close $client;
            next;
        }

        while (my $bytes = sysread($backend, my $buffer, 8192)) {
            syswrite($client, $buffer, $bytes);
        }

        close $backend;
        close $client;
    };

    if ($@) {
        warn "proxy error: $@";
        eval { close $client; };
    }
}
EOF

  chmod +x "$proxy_script"

  PROXY_LISTEN_HOST="$HOST" \
  PROXY_LISTEN_PORT="$PORT" \
  PROXY_BACKEND_HOST="$BACKEND_HOST" \
  PROXY_BACKEND_PORT="$BACKEND_PORT" \
  PROXY_API_PREFIX="$API_PREFIX" \
  PROXY_API_KEY="${API_KEY:-}" \
  PROXY_HEALTH_PATH="/health" \
    perl "$proxy_script"
}

args=(
  -m "$MODEL_PATH"
  -c "$CONTEXT_SIZE"
  -t "$N_THREADS"
  -np "$N_PARALLEL"
  -n "$N_PREDICT"
  --host "$BACKEND_HOST"
  --port "$BACKEND_PORT"
)

if [ -n "$API_PREFIX" ]; then
  args+=(--api-prefix "$API_PREFIX")
fi

if [ -n "$MODEL_ALIAS" ]; then
  args+=(--alias "$MODEL_ALIAS")
fi

if [ -n "${API_KEY:-}" ]; then
  args+=(--api-key "$API_KEY")
fi

if [ -n "${API_KEY:-}" ]; then
  llama-server "${args[@]}" &
  LLAMA_SERVER_PID=$!

  trap 'kill "$LLAMA_SERVER_PID" 2>/dev/null || true; wait "$LLAMA_SERVER_PID" 2>/dev/null || true' EXIT INT TERM

  start_proxy
fi

exec llama-server "${args[@]}"
