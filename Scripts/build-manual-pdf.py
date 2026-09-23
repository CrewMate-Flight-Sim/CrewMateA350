import base64
import html as html_mod
import io
import json
import mimetypes
import os
import re
import secrets
import socket
import struct
import subprocess
import sys
import tempfile
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANUAL = ROOT / "Manual" / "USER_MANUAL.md"
CSS = ROOT / "Manual" / "manual-print.css"
# Bundled with the app (see bundle.resources in tauri.conf.json), so the
# build output lives under src-tauri like the other shipped artefacts.
OUT = ROOT / "src-tauri" / "Manual" / "CrewmateA350-User-Manual.pdf"
TITLE = "CrewmateA350 — User Manual"
PORT = 9333

BROWSERS = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]

FOOTER = (
    '<div style="font-size:7pt;font-family:Segoe UI,sans-serif;color:#888;'
    'width:100%;padding:0 16mm;display:flex;justify-content:space-between;">'
    f"<span>{TITLE}</span>"
    '<span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>'
    "</div>"
)

ESCAPE_TOKEN = "\x00esc\x00"

# ── Markdown subset → HTML ───────────────────────────────────────────────────


def data_uri(path: Path) -> str:
    """Inline an image, quantised when Pillow is available."""
    raw = path.read_bytes()
    if path.suffix.lower() == ".png":
        try:
            from PIL import Image

            buf = io.BytesIO()
            Image.open(path).convert("RGB").quantize(colors=256).save(buf, "PNG", optimize=True)
            if buf.tell() < len(raw):
                raw = buf.getvalue()
        except Exception:
            pass
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return f"data:{mime};base64,{base64.b64encode(raw).decode()}"


def slug(text: str) -> str:
    return re.sub(r"\s", "-", re.sub(r"[^\w\s-]", "", text.lower()).strip())


def inline(text: str, base: Path) -> str:
    text = text.replace("\\_", ESCAPE_TOKEN)
    out = html_mod.escape(text, quote=False)
    out = re.sub(r"`([^`]+)`", lambda m: f"<code>{m.group(1)}</code>", out)

    def image(m: re.Match) -> str:
        target = (base / urllib.parse.unquote(m.group(2))).resolve()
        src = data_uri(target) if target.exists() else m.group(2)
        return f'<img src="{src}" alt="{m.group(1)}">'

    out = re.sub(r"!\[([^\]]*)\]\(([^)]+)\)", image, out)
    out = re.sub(r"(?<!!)\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', out)
    out = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", out)
    out = re.sub(r"(?<![\w*])_([^_\n]+)_(?![\w*])", r"<em>\1</em>", out)
    return out.replace(ESCAPE_TOKEN, "_")


def table(rows: list, base: Path) -> str:
    def cells(row):
        return [c.strip() for c in row.strip().strip("|").split("|")]

    out = ["<table><thead><tr>"]
    out += [f"<th>{inline(c, base)}</th>" for c in cells(rows[0])]
    out.append("</tr></thead><tbody>")
    for row in rows[2:]:
        out.append("<tr>" + "".join(f"<td>{inline(c, base)}</td>" for c in cells(row)) + "</tr>")
    out.append("</tbody></table>")
    return "".join(out)


def convert(md: str, base: Path):
    """Return (body html, contents html) for the manual's Markdown."""
    lines = md.splitlines()
    body, toc = [], []
    i = 0
    skipping_own_toc = False

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        heading = re.match(r"^(#{1,6})\s+(.*)$", line)
        if heading:
            level, text = len(heading.group(1)), heading.group(2).strip()
            # The document's own contents list is replaced by the generated one.
            skipping_own_toc = text.lower() == "table of contents"
            if not skipping_own_toc:
                anchor = slug(text)
                body.append(f'<h{level} id="{anchor}">{inline(text, base)}</h{level}>')
                if level == 2:
                    toc.append(f'<li><a href="#{anchor}">{inline(text, base)}</a></li>')
                elif level == 3:
                    toc.append(f'<li class="sub"><a href="#{anchor}">{inline(text, base)}</a></li>')
            i += 1
            continue

        if skipping_own_toc or not stripped:
            i += 1
            continue

        if stripped == "---":
            body.append("<hr>")
            i += 1
            continue

        if line.startswith("<"):  # raw HTML block, e.g. the cover image
            while i < len(lines) and lines[i].strip():
                body.append(lines[i])
                i += 1
            continue

        if stripped.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                rows.append(lines[i])
                i += 1
            if len(rows) >= 2:
                body.append(table(rows, base))
            continue

        if stripped.startswith("> "):
            quote = []
            while i < len(lines) and lines[i].strip().startswith("> "):
                quote.append(lines[i].strip()[2:])
                i += 1
            body.append(f"<blockquote><p>{inline(' '.join(quote), base)}</p></blockquote>")
            continue

        if re.match(r"^\s*- ", line):
            items = []
            while i < len(lines) and (
                re.match(r"^\s*- ", lines[i]) or (items and lines[i].startswith("  ") and lines[i].strip())
            ):
                if re.match(r"^\s*- ", lines[i]):
                    items.append(inline(re.sub(r"^\s*- ", "", lines[i]), base))
                else:  # continuation line, e.g. an image indented under a bullet
                    items[-1] += " " + inline(lines[i].strip(), base)
                i += 1
            body.append("<ul>" + "".join(f"<li>{it}</li>" for it in items) + "</ul>")
            continue

        para = []
        while i < len(lines) and lines[i].strip() and not re.match(r"^\s*[-|>#<]", lines[i]):
            para.append(lines[i].strip())
            i += 1
        text = inline(" ".join(para), base)
        # A paragraph that is only an image becomes a figure, so the alt text prints.
        figure = re.fullmatch(r'<img src="([^"]+)" alt="([^"]*)">', text)
        if figure:
            body.append(
                f'<figure><img src="{figure.group(1)}" alt="{figure.group(2)}">'
                f"<figcaption>{figure.group(2)}</figcaption></figure>"
            )
        else:
            body.append(f"<p>{text}</p>")

    return "\n".join(body), "<ul>" + "".join(toc) + "</ul>"


def render_html(target: Path) -> None:
    body, toc = convert(MANUAL.read_text(encoding="utf-8"), MANUAL.parent)
    target.write_text(
        "<!doctype html><html><head><meta charset='utf-8'>"
        f"<title>{html_mod.escape(TITLE)}</title>"
        f"<style>{CSS.read_text(encoding='utf-8')}</style></head><body>"
        f'<h1 class="title">{html_mod.escape(TITLE)}</h1>'
        f'<nav id="TOC"><h2 class="toc-heading">Contents</h2>{toc}</nav>'
        f"{body}</body></html>",
        encoding="utf-8",
    )


# ── Minimal DevTools protocol client ─────────────────────────────────────────


class Socket:
    """Just enough RFC 6455 to talk to Chrome: masked frames out, frames in."""

    def __init__(self, url: str) -> None:
        parts = urllib.parse.urlparse(url)
        self.sock = socket.create_connection((parts.hostname, parts.port), timeout=120)
        key = base64.b64encode(secrets.token_bytes(16)).decode()
        # No Origin header: Chrome rejects cross-origin debugger connections.
        self.sock.sendall(
            (
                f"GET {parts.path} HTTP/1.1\r\n"
                f"Host: {parts.hostname}:{parts.port}\r\n"
                "Upgrade: websocket\r\nConnection: Upgrade\r\n"
                f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n"
            ).encode()
        )
        header = b""
        while b"\r\n\r\n" not in header:
            header += self.sock.recv(1)
        if b"101" not in header.split(b"\r\n")[0]:
            raise RuntimeError(f"websocket handshake failed: {header.splitlines()[0]!r}")

    def _read(self, n: int) -> bytes:
        buf = b""
        while len(buf) < n:
            chunk = self.sock.recv(n - len(buf))
            if not chunk:
                raise RuntimeError("websocket closed")
            buf += chunk
        return buf

    def send(self, payload: dict) -> None:
        data = json.dumps(payload).encode()
        frame = bytearray([0x81])
        mask = secrets.token_bytes(4)
        if len(data) < 126:
            frame.append(0x80 | len(data))
        elif len(data) < 1 << 16:
            frame.append(0x80 | 126)
            frame += struct.pack(">H", len(data))
        else:
            frame.append(0x80 | 127)
            frame += struct.pack(">Q", len(data))
        frame += mask
        self.sock.sendall(bytes(frame) + bytes(b ^ mask[i % 4] for i, b in enumerate(data)))

    def recv(self) -> dict:
        message = b""
        while True:
            first, second = self._read(2)
            length = second & 0x7F
            if length == 126:
                length = struct.unpack(">H", self._read(2))[0]
            elif length == 127:
                length = struct.unpack(">Q", self._read(8))[0]
            payload = self._read(length)
            opcode = first & 0x0F
            if opcode == 0x8:
                raise RuntimeError("websocket closed by the browser")
            if opcode == 0x9:  # ping — Chrome does not expect a pong here
                continue
            message += payload
            if first & 0x80:  # FIN
                return json.loads(message)

    def close(self) -> None:
        try:
            self.sock.close()
        except OSError:
            pass


def find_browser() -> str:
    for path in BROWSERS:
        if os.path.exists(path):
            return path
    sys.exit("Chrome or Edge not found — install one, or add its path to BROWSERS.")


def page_socket() -> str:
    for _ in range(100):
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json/list", timeout=1) as r:
                for target in json.load(r):
                    if target.get("type") == "page":
                        return target["webSocketDebuggerUrl"]
        except Exception:
            pass
        time.sleep(0.2)
    sys.exit("The browser did not expose a debugging target.")


def main() -> None:
    browser = find_browser()
    with tempfile.TemporaryDirectory() as tmp:
        html = Path(tmp) / "manual.html"
        render_html(html)

        chrome = subprocess.Popen(
            [
                browser,
                "--headless",
                "--disable-gpu",
                "--no-first-run",
                f"--remote-debugging-port={PORT}",
                f"--user-data-dir={tmp}/profile",
                html.as_uri(),
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        ws = None
        try:
            ws = Socket(page_socket())
            for n in range(60):  # let the inlined images decode before printing
                ws.send(
                    {
                        "id": 100 + n,
                        "method": "Runtime.evaluate",
                        "params": {"expression": "document.readyState"},
                    }
                )
                if ws.recv().get("result", {}).get("result", {}).get("value") == "complete":
                    break
                time.sleep(0.25)

            ws.send(
                {
                    "id": 1,
                    "method": "Page.printToPDF",
                    "params": {
                        "printBackground": True,
                        "preferCSSPageSize": True,
                        "displayHeaderFooter": True,
                        "headerTemplate": "<div></div>",
                        "footerTemplate": FOOTER,
                        "generateDocumentOutline": True,
                    },
                }
            )
            while True:
                message = ws.recv()
                if message.get("id") == 1:
                    break
            if "error" in message:
                sys.exit(f"printToPDF failed: {message['error']}")
            OUT.parent.mkdir(parents=True, exist_ok=True)
            OUT.write_bytes(base64.b64decode(message["result"]["data"]))
        finally:
            if ws:
                ws.close()
            chrome.terminate()
            chrome.wait(timeout=30)

    print(f"Wrote {OUT} ({OUT.stat().st_size / 1_048_576:.1f} MB)")


if __name__ == "__main__":
    main()
