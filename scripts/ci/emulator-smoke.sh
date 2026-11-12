#!/usr/bin/env bash
# Android emulator smoke test for the release APK. Run inside a booted emulator by .github/workflows/device-check.yml:
#
#   scripts/ci/emulator-smoke.sh <path-to.apk> [output-dir]
#
# On a real Android runtime (Android 14 emulator) it checks that
#   * the APK installs,
#   * the first-run Home screen renders ("Add your first employer"),
#   * Calendar, History and Statistics open and render,
#   * the app survives being killed and started again,
#   * no crash or ANR is logged.
# Screenshots, UI dumps and the log are written to the output directory as evidence. This is a smoke test, not a
# replacement for trying the app by hand (docs/SMOKE_TEST.md).
set -uo pipefail

APK="${1:?usage: emulator-smoke.sh <apk> [out-dir]}"
OUT="${2:-smoke-out}"
PKG="com.workearn.app"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p "$OUT"
failures=0

pass() { echo "PASS: $*"; }
fail() { echo "FAIL: $*"; failures=$((failures + 1)); }

launch() { adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 > /dev/null 2>&1; }
shot() { adb exec-out screencap -p > "$OUT/$1.png" 2>/dev/null; }

# dump_ui <name>: writes $OUT/ui-<name>.xml; succeeds once the dump contains nodes (uiautomator can be briefly busy).
dump_ui() {
  local name="$1"
  for _ in 1 2 3 4 5; do
    adb shell uiautomator dump /sdcard/ui.xml > /dev/null 2>&1
    if adb pull /sdcard/ui.xml "$OUT/ui-$name.xml" > /dev/null 2>&1 && grep -q "<node" "$OUT/ui-$name.xml"; then
      return 0
    fi
    sleep 2
  done
  return 1
}

# wait_for_text <name> <text> [seconds]: polls the screen until the text appears.
wait_for_text() {
  local name="$1" text="$2" limit="${3:-60}" start now
  start=$(date +%s)
  while :; do
    if dump_ui "$name" && grep -qF "$text" "$OUT/ui-$name.xml"; then
      return 0
    fi
    now=$(date +%s)
    if [ $((now - start)) -ge "$limit" ]; then
      return 1
    fi
    sleep 2
  done
}

# tap_label <dump-name> <label>: taps the centre of the first node whose text or content-desc matches the label.
tap_label() {
  local coords x y
  coords=$(python3 "$HERE/ui_centre.py" "$OUT/ui-$1.xml" "$2") || return 1
  read -r x y <<< "$coords"
  adb shell input tap "$x" "$y"
}

echo "== Device: $(adb shell getprop ro.product.model | tr -d '\r'), Android $(adb shell getprop ro.build.version.release | tr -d '\r') (API $(adb shell getprop ro.build.version.sdk | tr -d '\r'))"
adb shell getprop ro.product.cpu.abi | tr -d '\r' | sed 's/^/   CPU ABI: /'

echo "== 1. Install"
adb install -r "$APK" 2>&1 | tee "$OUT/install.txt"
if grep -q "^Success" "$OUT/install.txt"; then
  pass "APK installed"
else
  fail "APK did not install"
  echo "RESULT: $failures failure(s)" | tee "$OUT/RESULT.txt"
  exit 1
fi

echo "== 2. Permissions the app asks for (information only; the build workflow enforces the allow-list)"
adb shell dumpsys package "$PKG" > "$OUT/package-dump.txt" 2>&1
sed -n '/requested permissions:/,/install permissions:/p' "$OUT/package-dump.txt" | tee "$OUT/permissions.txt"

echo "== 3. First launch"
adb logcat -c
launch
if wait_for_text home "Add your first employer" 90; then
  pass "Home screen rendered (first-run empty state)"
else
  fail "Home screen did not render within 90 s"
fi
shot 01-home

echo "== 4. Other screens (tab bar)"
for spec in "Calendar|Previous month|02-calendar" "History|No shifts yet|03-history" "Statistics|Nothing to show yet|04-statistics"; do
  IFS='|' read -r tab expect name <<< "$spec"
  if tap_label home "$tab"; then
    if wait_for_text "$name" "$expect" 30; then
      pass "$tab screen rendered (found \"$expect\")"
    else
      fail "$tab screen did not show \"$expect\""
    fi
  else
    fail "tab \"$tab\" not found on screen"
  fi
  shot "$name"
done

echo "== 5. Kill the app and start it again"
adb shell am force-stop "$PKG"
sleep 2
launch
if wait_for_text restart "Add your first employer" 60; then
  pass "App started again after being killed"
else
  fail "App did not render after a restart"
fi
shot 05-after-restart
if [ -n "$(adb shell pidof "$PKG" | tr -d '\r')" ]; then
  pass "App process is running"
else
  fail "App process is not running"
fi

echo "== 6. Crash scan"
adb logcat -d > "$OUT/logcat.txt" 2>&1
if grep -E "FATAL EXCEPTION|ANR in $PKG" "$OUT/logcat.txt" > "$OUT/crashes.txt"; then
  fail "crash or ANR in the log:"
  head -20 "$OUT/crashes.txt"
else
  pass "no crash or ANR in the log"
fi
# JavaScript errors are reported but do not fail the run on their own.
if grep -E "ReactNativeJS.*(E |Error)" "$OUT/logcat.txt" | head -5 | sed 's/^/   WARN JS: /' | grep -q .; then
  grep -E "ReactNativeJS.*(E |Error)" "$OUT/logcat.txt" | head -5 | sed 's/^/   WARN JS: /'
fi

echo
if [ "$failures" -eq 0 ]; then
  echo "RESULT: all checks passed" | tee "$OUT/RESULT.txt"
else
  echo "RESULT: $failures failure(s)" | tee "$OUT/RESULT.txt"
fi
[ "$failures" -eq 0 ]
