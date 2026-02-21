#!/usr/bin/env bash

CHECK_ONLY=false
if [ "${1:-}" = "--check" ]; then
  CHECK_ONLY=true
fi

echo "Pitch-Shifter Demo - Dev Setup (macOS/Linux)"
echo "CheckOnly: ${CHECK_ONLY}"
echo ""

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

print_ok() {
  echo "[OK] $1"
}

print_missing() {
  echo "[MISSING] $1"
}

print_warn() {
  echo "[WARN] $1"
}

PM=""
OS="$(uname -s)"
if [ "$OS" = "Darwin" ]; then
  if command_exists brew; then
    PM="brew"
  else
    print_warn "Homebrew not found. Install Homebrew or install dependencies manually."
  fi
else
  if command_exists apt-get; then
    PM="apt"
  else
    print_warn "apt-get not found. Install dependencies manually for your distro."
  fi
fi

APT_UPDATED=false
apt_update_once() {
  if [ "$APT_UPDATED" = false ]; then
    sudo apt-get update
    APT_UPDATED=true
  fi
}

install_pkg() {
  name="$1"
  case "$PM" in
    brew)
      if [ "$CHECK_ONLY" = true ]; then
        echo "[SKIP] ${name} (check-only mode)"
      else
        brew install "$name"
      fi
      ;;
    apt)
      if [ "$CHECK_ONLY" = true ]; then
        echo "[SKIP] ${name} (check-only mode)"
      else
        apt_update_once
        sudo apt-get install -y "$name"
      fi
      ;;
    *)
      print_warn "No package manager available to install ${name}."
      ;;
  esac
}

check_with_version() {
  label="$1"
  cmd="$2"
  args="$3"
  if command_exists "$cmd"; then
    if [ "$CHECK_ONLY" = true ]; then
      print_ok "${label}"
    else
      version="$($cmd $args 2>/dev/null | head -n 1)"
      if [ -n "$version" ]; then
        print_ok "${label} (${version})"
      else
        print_ok "${label}"
      fi
    fi
    return 0
  fi
  print_missing "${label}"
  return 1
}

check_with_version "Git" "git" "--version" || install_pkg git
check_with_version "Node.js" "node" "--version" || install_pkg node
check_with_version "npm" "npm" "--version" || print_warn "npm missing. Reinstall Node.js."

if check_with_version ".NET SDK" "dotnet" "--version"; then
  true
else
  if [ "$PM" = "brew" ]; then
    if [ "$CHECK_ONLY" = true ]; then
      echo "[SKIP] dotnet-sdk (check-only mode)"
    else
      brew install --cask dotnet-sdk
    fi
  elif [ "$PM" = "apt" ]; then
    if [ "$CHECK_ONLY" = true ]; then
      echo "[SKIP] dotnet-sdk-8.0 (check-only mode)"
    else
      apt_update_once
      sudo apt-get install -y dotnet-sdk-8.0 || print_warn "dotnet-sdk-8.0 not available. See Microsoft docs for repo setup."
    fi
  else
    print_warn "Install .NET SDK manually."
  fi
fi

echo ""
echo "Checking Angular CLI..."
if command_exists ng; then
  if [ "$CHECK_ONLY" = true ]; then
    print_ok "Angular CLI"
  else
    ng_ver="$(ng version 2>/dev/null | head -n 1)"
    if [ -n "$ng_ver" ]; then
      print_ok "Angular CLI (${ng_ver})"
    else
      print_ok "Angular CLI"
    fi
  fi
else
  print_missing "Angular CLI"
  if command_exists npm; then
    if [ "$CHECK_ONLY" = true ]; then
      echo "[SKIP] Angular CLI install (check-only mode)"
    else
      npm install -g @angular/cli
    fi
  else
    print_warn "npm not found. Install Node.js first."
  fi
fi

echo ""
echo "Done. Re-run this script after installing missing dependencies."
