"""PostgreSQL sessions over Neon's TLS WebSocket endpoint on port 443."""
import io
import json
import logging
import socket
import ssl
from contextlib import contextmanager
from decimal import Decimal

from pg8000 import dbapi
from websocket import create_connection


class FrameStream(io.RawIOBase):
    """Expose binary WebSocket frames as the buffered stream used by pg8000."""

    def __init__(self, ws):
        self.ws = ws
        self.remaining = memoryview(b"")

    def readable(self):
        return True

    def writable(self):
        return True

    def readinto(self, target):
        if not self.remaining:
            frame = self.ws.recv()
            if not frame:
                return 0
            if not isinstance(frame, bytes):
                raise OSError("Expected a binary PostgreSQL frame")
            self.remaining = memoryview(frame)
        length = min(len(target), len(self.remaining))
        target[:length] = self.remaining[:length]
        self.remaining = self.remaining[length:]
        return length

    def write(self, data):
        self.ws.send_binary(bytes(data))
        return len(data)

    def makefile(self, mode):
        return io.BufferedRWPair(self, self)


class Session:
    def __init__(self, connection):
        self.connection = connection

    def execute(self, sql, params=()):
        cursor = self.connection.cursor()
        try:
            cursor.execute(sql, params)
        except dbapi.DatabaseError as exc:
            details = exc.args[0] if exc.args and isinstance(exc.args[0], dict) else {}
            # Log only the static query shape, code and parser position. Driver
            # messages and parameters can contain accounting or connection data.
            first_line = sql.strip().splitlines()[0].split(" AS ")[0][:72]
            logging.getLogger(__name__).error("Analytics SQL failed (statement=%s, SQLSTATE=%s, position=%s)",
                                              first_line, details.get("C"), details.get("P"))
            raise
        columns = [c[0] for c in (cursor.description or [])]
        return Rows(dict(zip(columns, row)) for row in cursor) if columns else Rows(())


class Rows:
    def __init__(self, rows):
        self.rows = iter(rows)

    def __iter__(self):
        return self.rows

    def fetchone(self):
        return next(self.rows, None)

    def fetchall(self):
        return list(self.rows)


@contextmanager
def connect(settings):
    host = settings["host"].split(",")[0]
    certs = ssl.create_default_context(cafile=settings["sslrootcert"])
    # Use only the addresses validated by the production configuration. Prefer IPv4 on Vercel.
    addresses = sorted(settings["hostaddr"].split(","), key=lambda address: ":" in address)
    failures = []
    for address in addresses:
        try:
            raw = socket.create_connection((address, 443), timeout=12)
            break
        except OSError as exc:
            failures.append(("IPv6" if ":" in address else "IPv4", exc.errno))
            if address == addresses[-1]:
                logging.getLogger(__name__).error("Neon HTTPS endpoint unreachable (%s)", failures)
                raise
    with raw, certs.wrap_socket(raw, server_hostname=host) as tls:
        with websocket_session(tls, settings, host) as session:
            yield session


@contextmanager
def websocket_session(tls, settings, host):
    try:
        ws = create_connection("wss://" + host + "/v2", socket=tls, timeout=15, redirect_limit=0,
                               suppress_origin=True)
    except Exception as exc:
        logging.getLogger(__name__).error("Neon WebSocket upgrade failed (%s, HTTP %s)",
                                          type(exc).__name__, getattr(exc, "status_code", None))
        raise
    try:
        ws.settimeout(130)
        # TLS with hostname verification is established before any Postgres credentials are sent.
        with dbapi.connect(user=settings["user"], password=settings["password"], database=settings["dbname"],
                           host=host, sock=FrameStream(ws), ssl_context=False,
                           application_name="polivalko-business-analytics") as connection:
            for oid in (114, 3802):
                connection.register_in_adapter(oid, lambda value: json.loads(value, parse_float=Decimal))
            yield Session(connection)
    finally:
        ws.close(timeout=2)
