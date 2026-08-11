import assert from "node:assert/strict";
import test from "node:test";
import { registerPwaServiceWorker } from "./pwa";

function serviceWorker(register: () => void) {
  return {
    async register() {
      register();
      return {} as ServiceWorkerRegistration;
    },
  };
}

test("registers immediately after the page has loaded", () => {
  let registrations = 0;
  registerPwaServiceWorker({
    isSecureContext: true,
    readyState: "complete",
    serviceWorker: serviceWorker(() => {
      registrations += 1;
    }),
    addLoadListener() {
      assert.fail("load listener should not be used");
    },
  });

  assert.equal(registrations, 1);
});

test("defers registration until load without adding duplicate work", () => {
  let registrations = 0;
  let loadListener: (() => void) | undefined;
  registerPwaServiceWorker({
    isSecureContext: true,
    readyState: "loading",
    serviceWorker: serviceWorker(() => {
      registrations += 1;
    }),
    addLoadListener(listener) {
      loadListener = listener;
    },
  });

  assert.equal(registrations, 0);
  assert.ok(loadListener);
  loadListener();
  assert.equal(registrations, 1);
});

test("skips registration outside a secure service-worker environment", () => {
  let listenerAdded = false;
  registerPwaServiceWorker({
    isSecureContext: false,
    readyState: "complete",
    serviceWorker: serviceWorker(() => {
      assert.fail("service worker should not be registered");
    }),
    addLoadListener() {
      listenerAdded = true;
    },
  });

  assert.equal(listenerAdded, false);
});
