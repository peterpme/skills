# Performance research ladder

Climb one rung at a time. Start with the cheapest instrument that could explain the symptom, go lower only when it cannot, and record in the prior-art note which rung found the problem. Measure before and after on the same device or build.

| Rung | Mobile (React Native) | Chrome extension | What it finds |
|---|---|---|---|
| 1. Component | React DevTools profiler, argent's react-profiler, React Compiler output | React DevTools on the popup and options pages | Re-renders, wasted work, unmemoized lists |
| 2. JS runtime | Hermes sampling profiler over CDP, `agent-cdp profile cpu` | Chrome performance panel on the service worker and popup | Hot functions, long tasks, startup cost |
| 3. Bundle | Metro source-map analysis (`source-map-explorer`), duplicate-module check | The bundler's analyzer (Rsbuild/Rspack, webpack-bundle-analyzer), injected content-script size | Load-time cost, duplicate libraries |
| 4. Frames and native | Perfetto or systrace on Android, Instruments on iOS, the repo's frame benchmark on a real low-end phone | Not applicable | Dropped frames, main-thread contention, GC pauses |
| 5. Platform | Xcode and Android Studio profilers, native module timing | Chrome tracing (`chrome://tracing`), MV3 service-worker lifecycle events | Native work JS cannot see, worker restarts |

Rules for every rung:

- A real device or a production build for the number you report. A debug build or a simulator is fine for finding the problem, not for the before and after.
- One number per claim, with the instrument named next to it.
- Search the repo for an existing harness before writing one; if none exists, the harness is its own PR, with the baseline committed next to it.
