# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in the Android SDK's proguard-android.txt.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# --- Classes the native side resolves BY NAME -------------------------------
# `android/pixiquickjs/src/main/cpp/jni_bridge.cpp` runs in `JNI_OnLoad` and
# does `FindClass("com/pixi/mobile/sandbox/PixiSandboxModule")`,
# `GetStaticMethodID` on `onResult` / `onHostRequest` / `onLog`, and
# `RegisterNatives` with the method-name strings from `kNativeMethods`. Rename
# any of them and the extension sandbox never boots (JNI_OnLoad returns
# JNI_ERR) — so the whole package is frozen, class *and* member names.
-keep class com.pixi.mobile.sandbox.** { *; }

# react-native-mmkv v4 goes through Nitro: `cpp-adapter.cpp` ->
# `registerAllNatives()`, and Nitro's fbjni glue resolves its Java classes with
# `findClassStatic(javaClassDescriptor)` — again a string lookup.
-keep class com.margelo.nitro.** { *; }
-keep class com.tencent.mmkv.** { *; }

# --- Crash reports ----------------------------------------------------------
# R8 otherwise strips the file/line attribute, which turns every release
# stack trace into a column of anonymous frames.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
