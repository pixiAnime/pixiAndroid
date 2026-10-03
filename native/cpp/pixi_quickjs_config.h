/*
 * Build configuration for the vendored QuickJS engine.
 *
 * quickjs-ng expects CONFIG_VERSION to be supplied by the build system
 * (upstream generates it into version.h); the engine sources are kept
 * byte-identical to their origin, so we force-include this header instead.
 */
#ifndef PIXI_QUICKJS_CONFIG_H
#define PIXI_QUICKJS_CONFIG_H

#ifndef CONFIG_VERSION
#define CONFIG_VERSION "quickjs (vendored)"
#endif

#endif /* PIXI_QUICKJS_CONFIG_H */
