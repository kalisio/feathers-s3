#!/bin/bash

AGE_VERSION=1.1.1
SOPS_VERSION=3.8.1
TMP_PATH="$(mktemp -d -p "${XDG_RUNTIME_DIR:-}" kalisio.XXXXXX)"

install_age() {
    local DL_PATH="$TMP_PATH/age"
    mkdir "$DL_PATH" && pushd "$DL_PATH" || exit
    wget -q https://github.com/FiloSottile/age/releases/download/v${AGE_VERSION}/age-v${AGE_VERSION}-linux-amd64.tar.gz
    # no checksum ...
    tar xf age-v${AGE_VERSION}-linux-amd64.tar.gz
    cp age/age "$HOME/.local/bin"
    popd || exit
}

install_sops() {
    local DL_PATH="$TMP_PATH/sops"
    mkdir "$DL_PATH" && pushd "$DL_PATH" || exit
    wget -q https://github.com/getsops/sops/releases/download/v${SOPS_VERSION}/sops-v${SOPS_VERSION}.linux.amd64
    wget -q https://github.com/getsops/sops/releases/download/v${SOPS_VERSION}/sops-v${SOPS_VERSION}.checksums.txt
    sha256sum --ignore-missing --quiet -c sops-v${SOPS_VERSION}.checksums.txt
    cp sops-v${SOPS_VERSION}.linux.amd64 "$HOME/.local/bin/sops"
    chmod a+x "$HOME/.local/bin/sops"
    popd || exit
}

mkdir -p "$HOME/.local/bin"
install_age
install_sops
