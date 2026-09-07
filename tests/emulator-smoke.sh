#!/usr/bin/env bash
set -euo pipefail
mkdir -p device-results
trap 'adb logcat -d > device-results/logcat.txt 2>&1 || true' EXIT
adb install -r artifacts/NextPiano-2.0.0-preview.apk
adb install -r artifacts/instrumentation.apk
adb logcat -c || echo '::warning::Emulator could not clear logcat; continuing with instrumentation assertions.'
adb shell am instrument -w com.mikczemny.nextpiano.preview.test/androidx.test.runner.AndroidJUnitRunner | tee device-results/instrumentation.txt
grep -q 'OK (4 tests)' device-results/instrumentation.txt

# A cold WebView can paint AFTER Android reports Activity Displayed. The old 3s
# capture was a startup frame, so wait for real accessible page controls instead.
wait_for_visible_app() {
  local label="$1"
  for attempt in $(seq 1 12); do
    adb shell uiautomator dump /sdcard/nextpiano-window.xml >/dev/null 2>&1 || true
    adb pull /sdcard/nextpiano-window.xml "device-results/${label}-ui.xml" >/dev/null 2>&1 || true
    if grep -q 'Wycisz wszystko' "device-results/${label}-ui.xml" 2>/dev/null; then
      sleep 2
      return 0
    fi
    sleep 2
  done
  adb exec-out screencap -p > "device-results/${label}-failed.png"
  echo "App controls did not become accessible after cold start: ${label}" >&2
  return 1
}
adb shell am start -W -S -n com.mikczemny.nextpiano.preview/com.mikczemny.nextpiano.MainActivity
wait_for_visible_app phone
adb exec-out screencap -p > device-results/phone.png
adb shell wm size 1600x2560
adb shell wm density 240
sleep 3
wait_for_visible_app tablet
adb exec-out screencap -p > device-results/tablet.png
adb logcat -d > device-results/logcat.txt
! grep -A 5 'FATAL EXCEPTION' device-results/logcat.txt | grep -q 'com.mikczemny.nextpiano'
