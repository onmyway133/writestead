// Satori's bundled Emscripten loader sees WorkerGlobalScope and reads self.location.href while it
// loads. Workers have no usable location, so give it a placeholder. Import this before "satori".
const scope = globalThis as { location?: { href?: string } };
if (!scope.location?.href)
{
    Object.defineProperty(globalThis, "location", { value: { href: "https://worker.invalid/" }, configurable: true, writable: true });
}

export {};
