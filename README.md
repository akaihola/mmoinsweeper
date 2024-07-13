# Massively Multiplayer Online Infinite Minesweeper


## Running locally with SSL

1. Register a DNS name for your local machine on which you will run the server. For example, add an entry to your `/etc/hosts` file, or add a subdomain to a domain you own, and point it to your machine.
2. Install Rust: https://www.rust-lang.org/tools/install
3. Clone the repository: `git clone https://github.com/akaihola/mmoinsweeper.git`
4. Change to the project directory: `cd mmoinsweeper`
5. Create a self-signed certificate:

       openssl genrsa -out key.pem 2048
       openssl req -new -key key.pem -out csr.pem
       openssl x509 -req -days 365 -in csr.pem -signkey key.pem -out cert.pem

6. Run the server: `cargo run -- --port 3030 --tls --no-cache`
7. Open your browser and navigate to `https://localhost:3030`


## Nginx Configuration Example

Here's an example Nginx site configuration that terminates TLS, proxies static and WebSocket traffic to the Rust backend, and handles Let's Encrypt:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    # Redirect HTTP to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
    
    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
    }
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # SSL configuration (you may want to adjust these settings)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;

    # HSTS (optional, but recommended)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Proxy static files
    location / {
        proxy_pass http://localhost:3030;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Proxy WebSocket connections
    location /ws {
        proxy_pass http://localhost:3030;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Make sure to replace `yourdomain.com` with your actual domain name and adjust the paths for SSL certificates if necessary. Also, ensure that the Rust backend is running on localhost:3030 (or change the `proxy_pass` directive if it's running on a different port).

To use this configuration:

1. Install Nginx and Let's Encrypt (Certbot).
2. Save this configuration in `/etc/nginx/sites-available/yourdomain.com`.
3. Create a symbolic link: `ln -s /etc/nginx/sites-available/yourdomain.com /etc/nginx/sites-enabled/`.
4. Run Certbot to obtain SSL certificates: `certbot certonly --webroot -w /var/www/letsencrypt -d yourdomain.com`.
5. Test the Nginx configuration: `nginx -t`.
6. If the test is successful, reload Nginx: `systemctl reload nginx`.

This configuration will handle TLS termination, proxy requests to your Rust backend, and manage Let's Encrypt certificate renewals.
