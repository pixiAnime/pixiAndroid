cmake_minimum_required(VERSION 3.22.1)

# The sandbox engine is platform-neutral and lives outside this Android
# module: <repo>/native/{quickjs,cpp}. Nothing here reaches into React
# Native's C++ APIs — the bridge is plain JNI.
project(pixiquickjs C CXX)

set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(PIXI_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/../../../../..")
set(QUICKJS_DIR "${PIXI_ROOT}/native/quickjs")

add_library(
    pixiquickjs
    SHARED
    jni_bridge.cpp
    ${PIXI_ROOT}/native/cpp/pixi_sandbox.cpp
    ${QUICKJS_DIR}/quickjs.c
    ${QUICKJS_DIR}/cutils.c
    ${QUICKJS_DIR}/libregexp.c
    ${QUICKJS_DIR}/libunicode.c
    ${QUICKJS_DIR}/dtoa.c
)

target_include_directories(
    pixiquickjs
    PRIVATE
    ${PIXI_ROOT}/native/cpp
    ${QUICKJS_DIR}
)

# quickjs-ng assumes a POSIX-ish libc (strdup, alloca, gettimeofday).
target_compile_definitions(
    pixiquickjs
    PRIVATE
    _GNU_SOURCE
)

target_compile_options(
    pixiquickjs
    PRIVATE
    -fno-rtti
    # QuickJS expects CONFIG_VERSION from the build system; provide it
    # without touching the vendored sources.
    $<$<COMPILE_LANGUAGE:C>:-include>
    $<$<COMPILE_LANGUAGE:C>:pixi_quickjs_config.h>
    $<$<COMPILE_LANGUAGE:C>:-O2;-fno-strict-aliasing;-Wno-unused-parameter>
    $<$<COMPILE_LANGUAGE:CXX>:-O2;-Wno-unused-parameter>
)

find_library(log-lib log)
target_link_libraries(pixiquickjs ${log-lib})
