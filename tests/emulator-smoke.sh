#!/usr/bin/env bash
set -euo pipefail
mkdir -p device-results
adb install -r artifacts/NextPiano-2.0.0-preview.apk
adb install -r artifacts/instrumentation.apk
adb logcat -c
adb shell am instrument -w com.mikczemny.nextpiano.preview.test/androidx.test.runner.AndroidJUnitRunner | tee device-results/instrumentation.txt
grep -q 'OK (4 tests)' device-results/instrumentation.txt
adb shell am start -n com.mikczemny.nextpiano.preview/com.mikczemny.nextpiano.MainActivity
sleep 3
adb exec-out screencap -p > device-results/phone.png
adb shell wm size 1600x2560
adb shell wm density 240
sleep 3
adb exec-out screencap -p > device-results/tablet.png
adb logcat -d > device-results/logcat.txt
! grep -q 'FATAL EXCEPTION' device-results/logcat.txt
