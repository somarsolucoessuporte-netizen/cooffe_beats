// Polyfills para Chrome >= 60 / Android WebView antigo

// globalThis
if (typeof globalThis === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).globalThis = window;
}

// Promise.allSettled (Chrome < 76)
if (typeof Promise !== "undefined" && !Promise.allSettled) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Promise as any).allSettled = function (promises: Promise<unknown>[]) {
    return Promise.all(
      promises.map(function (p) {
        return Promise.resolve(p).then(
          function (value) { return { status: "fulfilled", value: value }; },
          function (reason) { return { status: "rejected", reason: reason }; }
        );
      })
    );
  };
}

export {};
