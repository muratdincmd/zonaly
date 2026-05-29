// Detect the host OS at runtime from the Tauri user-agent string.
// This runs once and is cached — safe to call from anywhere.

const ua = navigator.userAgent.toLowerCase();

export const isWindows = ua.includes("windows");
export const isMac     = ua.includes("macintosh") || ua.includes("mac os");
export const isLinux   = !isWindows && !isMac;

// True when a custom title bar should be rendered (Windows only).
// macOS uses the native overlay style; Linux keeps native decorations.
export const useCustomTitleBar = isWindows;
