#!/bin/bash
# 反诈库直查：web 前端 → WebView 壳 → APK
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WS="$(cd "$ROOT/.." && pwd)"
BT="$WS/toolchain/bt/android-14"
AJ="$WS/toolchain/plat/android-36/android.jar"
export JAVA_HOME="$WS/toolchain/jdk-17.0.21+9"
export PATH="$JAVA_HOME/bin:$PATH"

OUT="$ROOT/build"
ASSETS="$ROOT/android/assets"
rm -rf "$OUT" "$ASSETS"
mkdir -p "$OUT/gen" "$OUT/classes" "$OUT/dex" "$OUT/apk" "$ASSETS"
cp "$ROOT"/web/*.js "$ROOT"/web/*.css "$ROOT"/web/*.html "$ASSETS/"

echo "[1/6] aapt2 compile"
"$BT/aapt2" compile --dir "$ROOT/android/res" -o "$OUT/res.zip"

echo "[2/6] aapt2 link"
"$BT/aapt2" link -o "$OUT/apk/base.apk" \
  -I "$AJ" \
  --manifest "$ROOT/android/AndroidManifest.xml" \
  -A "$ASSETS" \
  --java "$OUT/gen" \
  --min-sdk-version 26 \
  --target-sdk-version 34 \
  "$OUT/res.zip"

echo "[3/6] javac"
javac -nowarn -source 8 -target 8 -bootclasspath "$AJ" -d "$OUT/classes" \
  "$OUT/gen/com/catsuki/fkmiui/R.java" \
  "$ROOT"/android/src/com/catsuki/fkmiui/*.java

echo "[4/6] d8"
"$BT/d8" --lib "$AJ" --min-api 26 --output "$OUT/dex" $(find "$OUT/classes" -name '*.class' | tr '\n' ' ')

echo "[5/6] pack dex"
python3 - "$OUT" <<'PY'
import zipfile, shutil, sys, os
out = sys.argv[1]
src = os.path.join(out, 'apk/base.apk'); dst = os.path.join(out, 'apk/unaligned.apk')
shutil.copy(src, dst)
with zipfile.ZipFile(dst, 'a', zipfile.ZIP_DEFLATED) as z:
    z.write(os.path.join(out, 'dex/classes.dex'), 'classes.dex')
PY

echo "[6/6] zipalign + sign"
KS="$ROOT/android/frauddb.keystore"
if [ ! -f "$KS" ]; then
  keytool -genkeypair -keystore "$KS" -alias frauddb -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass frauddb -keypass frauddb -dname "CN=FraudDB, OU=App, O=Rikka, C=CN" 2>/dev/null
fi
"$BT/zipalign" -f 4 "$OUT/apk/unaligned.apk" "$OUT/apk/aligned.apk"
"$BT/apksigner" sign --ks "$KS" --ks-pass pass:frauddb --key-pass pass:frauddb \
  --v1-signing-enabled true --v2-signing-enabled true \
  --out "$OUT/frauddb.apk" "$OUT/apk/aligned.apk"
cp "$OUT/frauddb.apk" "$WS/frauddb.apk"
"$BT/apksigner" verify --print-certs "$OUT/frauddb.apk" | head -2
ls -la "$OUT/frauddb.apk"
