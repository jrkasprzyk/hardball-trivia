#!/usr/bin/env python3
"""Simple static file server that maps /trivia -> questions.json and adds CORS headers.

Run: python serve_with_cors.py --port 8000
This will serve the repository root and respond to GET /trivia with questions.json
and include Access-Control-Allow-Origin: * for development.
"""
from http.server import SimpleHTTPRequestHandler, HTTPServer

class CORSRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200, "ok")
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        # Map /trivia -> questions.json
        if self.path == '/trivia':
            try:
                with open('questions.json', 'rb') as f:
                    content = f.read()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(content)))
                self.end_headers()
                self.wfile.write(content)
            except FileNotFoundError:
                self.send_error(404, 'questions.json not found')
        else:
            return super().do_GET()


def run(port=8000):
    addr = ('', port)
    httpd = HTTPServer(addr, CORSRequestHandler)
    print(f"Serving on http://127.0.0.1:{port} — /trivia -> questions.json (CORS enabled)")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nShutting down')
        httpd.server_close()


if __name__ == '__main__':
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument('--port', type=int, default=8000)
    args = p.parse_args()
    run(args.port)
