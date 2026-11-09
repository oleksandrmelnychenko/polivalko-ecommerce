#!/usr/bin/env sh
set -eu
umask 077
key_dir=${1:?Usage: create-key-certificate.sh /private/path/to/certificates}
mkdir -p "$key_dir"
if [ -e "$key_dir/current.crt" ] || [ -e "$key_dir/current.key" ]; then
  echo 'Refusing to overwrite an existing certificate. Preserve it for decryption when rotating.' >&2
  exit 1
fi
openssl req -x509 -newkey rsa:3072 -sha256 -nodes -days 3650 \
  -subj '/CN=PoliValko Data Protection/' \
  -keyout "$key_dir/current.key" -out "$key_dir/current.crt"
chmod 600 "$key_dir/current.key" "$key_dir/current.crt"
printf 'Certificate created in %s. Back up this directory separately from the database.\n' "$key_dir"
